import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
  Linking,
  ScrollView,
  Animated,
} from 'react-native';
import SafeAreaView from '../../components/SafeAreaView';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { supabase } from '../../config/supabase';
import { getSocialPosts, getSwapPosts, updateUserLocation } from '../../services/postsService';
import { likePost, unlikePost, getEngagementForPosts } from '../../services/engagementService';
import { seedPostCache, getPersisted, setPersisted } from '../../utils/memoryCache';
import { getUnreadCount } from '../../services/notificationsService';
import { useAuthStore } from '../../store/authStore';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';
import ReportModal from '../../components/ReportModal';
import { blockUser, getBlockedUserIds } from '../../services/blockService';
import { reportPost } from '../../services/reportService';
import { getWantToReadTitles, normalizeTitle } from '../../services/shelfService';
import { Heart, ChatCircle, Bell, MapPin, DotsThree, Books, ArrowsClockwise, WarningCircle, Bookmark, ArrowUp } from 'phosphor-react-native';
import { fonts } from '../../theme/fonts';

interface Props {
  navigation: any;
}

type TabType = 'feed' | 'swaps';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 16;
const GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;
const COVER_HEIGHT = Math.round(CARD_WIDTH * 1.5); // 2:3 aspect ratio for book covers

// Dynamic font size based on title length
const getTitleFontSize = (title: string) => {
  if (title.length > 40) return 12;
  if (title.length > 25) return 13;
  return 15;
};

interface PostWithEngagement extends Post {
  likeCount: number;
  commentCount: number;
  hasLiked: boolean;
}

export default function FeedScreen({ navigation }: Props) {
  const session = useAuthStore((state) => state.session);
  const hasPosted = useAuthStore((state) => state.hasPosted);
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [posts, setPosts] = useState<PostWithEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [wishlistTitles, setWishlistTitles] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationPromptNeeded, setLocationPromptNeeded] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [newAvailable, setNewAvailable] = useState(false);

  // Per-tab cache so switching tabs is instant (no empty-state flash); a
  // background refresh then reveals newer content via the "new posts" pill.
  const cacheRef = useRef<Record<TabType, PostWithEngagement[]>>({ feed: [], swaps: [] });
  const pendingRef = useRef<PostWithEngagement[] | null>(null);
  const activeTabRef = useRef<TabType>(activeTab);
  // Feed and Swaps are two side-by-side pages in a horizontal pager: swipe or
  // tap to switch. Each page keeps its own list mounted, so scroll position and
  // content survive switching.
  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const loadedRef = useRef<Record<TabType, boolean>>({ feed: false, swaps: false });
  const [, forceRender] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  // Lists painted from disk are last session's — replace them silently when
  // fresh data lands rather than offering the "new posts" pill.
  const fromDiskRef = useRef<Record<TabType, boolean>>({ feed: false, swaps: false });
  const diskKey = (tab: TabType) => `feed:${session?.user.id}:${tab}`;

  // Cold open: paint last session's lists from disk while fresh data loads.
  useEffect(() => {
    if (!session?.user.id) return;
    (['feed', 'swaps'] as const).forEach(async (tab) => {
      const saved = await getPersisted<PostWithEngagement[]>(diskKey(tab));
      if (!saved?.length || cacheRef.current[tab].length > 0 || loadedRef.current[tab]) return;
      cacheRef.current[tab] = saved;
      fromDiskRef.current[tab] = true;
      seedPostCache(saved);
      if (activeTabRef.current === tab) {
        setPosts(saved);
        setLoading(false);
      } else {
        forceRender((n) => n + 1);
      }
    });
  }, [session?.user.id]);
  activeTabRef.current = activeTab;

  // Keep the active tab's cache in step with edits (likes, load-more) so the
  // off-screen page shows current data.
  useEffect(() => {
    cacheRef.current[activeTabRef.current] = posts;
  }, [posts]);

  useFocusEffect(
    useCallback(() => {
      const prepare = async () => {
        let blocked: string[] = [];
        if (session?.user.id) {
          try {
            blocked = await getBlockedUserIds(session.user.id);
            setBlockedIds(blocked);
          } catch {
            blocked = [];
          }
          getUnreadCount(session.user.id).then(setUnreadNotifications).catch(() => {});
          // Slice 4: wishlist titles for "On your wishlist" badges on swap cards
          getWantToReadTitles(session.user.id)
            .then((titles) => setWishlistTitles(titles.map(normalizeTitle)))
            .catch(() => setWishlistTitles([]));
        }

        // Location for nearby Swaps tab — explain first, ask only on tap.
        // getForegroundPermissionsAsync never prompts; the system dialog
        // appears only after the user taps "Enable location".
        let locForFetch: { latitude: number; longitude: number } | null = null;
        if (activeTab === 'swaps') {
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              locForFetch = await getFastPosition();
              setUserLocation(locForFetch);
              setLocationDenied(false);
              setLocationPromptNeeded(false);
              if (session?.user.id) updateUserLocation(session.user.id, locForFetch.latitude, locForFetch.longitude);
            } else if (status === 'denied') {
              setUserLocation(null);
              setLocationDenied(true);
              setLocationPromptNeeded(false);
            } else {
              // Undetermined — show the explainer, fetch unfiltered meanwhile
              setUserLocation(null);
              setLocationDenied(false);
              setLocationPromptNeeded(true);
            }
          } catch {
            setUserLocation(null);
          }
        }

        loadPostsWithBlocked(blocked, locForFetch);
      };

      prepare();
    }, [activeTab, session?.user.id])
  );

  // A recent last-known fix is instant; a fresh GPS fix can take seconds and
  // used to stall the Swaps tab before anything loaded.
  const getFastPosition = async () => {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
    const loc = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

  const enrichPosts = async (data: Post[]): Promise<PostWithEngagement[]> => {
    const posts = data || [];
    const engagement = await getEngagementForPosts(posts.map((p) => p.id), session?.user.id);
    return posts.map((post) => ({ ...post, ...engagement[post.id] }));
  };

  const fetchTab = async (
    tab: TabType,
    blocked: string[],
    loc: { latitude: number; longitude: number } | null
  ): Promise<PostWithEngagement[]> => {
    const data =
      tab === 'feed'
        ? await getSocialPosts(20, 0, blocked)
        : await getSwapPosts(20, 0, blocked, loc);
    const enriched = await enrichPosts(data);
    seedPostCache(enriched);
    loadedRef.current[tab] = true;
    setPersisted(diskKey(tab), enriched);
    return enriched;
  };

  const loadPostsWithBlocked = async (
    blocked: string[],
    loc: { latitude: number; longitude: number } | null = userLocation
  ) => {
    const tab = activeTab;
    setError(null);

    const cached = cacheRef.current[tab];
    if (cached && cached.length > 0) {
      // Show the cache instantly, then refresh in the background.
      setPosts(cached);
      setLoading(false);
      try {
        const fresh = await fetchTab(tab, blocked, loc);
        cacheRef.current[tab] = fresh;
        if (activeTabRef.current !== tab) return; // switched away mid-fetch
        const isNew = fresh.length > 0 && fresh[0]?.id !== cached[0]?.id;
        const wasFromDisk = fromDiskRef.current[tab];
        fromDiskRef.current[tab] = false;
        if (isNew && !wasFromDisk) {
          // Newer content on top — don't yank the list; offer a pill instead.
          pendingRef.current = fresh;
          setNewAvailable(true);
        } else {
          setPosts(fresh);
        }
      } catch {
        // Keep showing the cache on a background failure.
      }
      return;
    }

    // First load for this tab — show the spinner.
    setLoading(true);
    try {
      const fresh = await fetchTab(tab, blocked, loc);
      cacheRef.current[tab] = fresh;
      if (activeTabRef.current === tab) setPosts(fresh);
      prefetchOtherTab(tab, blocked);
    } catch (error: any) {
      console.error('Error loading posts:', error);
      setError(error?.message || 'Failed to load posts. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Warm the other tab's cache in the background so the first switch is instant.
  const prefetchOtherTab = async (current: TabType, blocked: string[]) => {
    const other: TabType = current === 'feed' ? 'swaps' : 'feed';
    if (cacheRef.current[other].length > 0) return;
    try {
      let loc: { latitude: number; longitude: number } | null = null;
      if (other === 'swaps') {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') loc = await getFastPosition();
      }
      const fresh = await fetchTab(other, blocked, loc);
      if (cacheRef.current[other].length === 0) {
        cacheRef.current[other] = fresh;
        forceRender((n) => n + 1); // paint the neighbouring page
      }
    } catch {
      // Best effort — the tab loads normally when opened.
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const tab = activeTab;
    try {
      const loc = tab === 'swaps' ? userLocation : null;
      const fresh = await fetchTab(tab, blockedIds, loc);
      cacheRef.current[tab] = fresh;
      if (activeTabRef.current === tab) {
        setPosts(fresh);
        pendingRef.current = null;
        setNewAvailable(false);
      }
      setError(null);
    } catch (error: any) {
      console.error('Error refreshing:', error);
      if (posts.length === 0) setError(error?.message || 'Failed to refresh. Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetry = () => {
    loadPostsWithBlocked(blockedIds, userLocation);
  };

  const handleEnableLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        setLocationDenied(false);
        setLocationPromptNeeded(false);
        if (session?.user.id) updateUserLocation(session.user.id, coords.latitude, coords.longitude);
        loadPostsWithBlocked(blockedIds, coords);
      } else {
        setLocationDenied(true);
        setLocationPromptNeeded(false);
      }
    } catch {
      setLocationDenied(true);
      setLocationPromptNeeded(false);
    }
  };

  // Re-enable path from the amber "Location off" banner: if the OS can still be
  // asked (e.g. after tapping "Not now"), prompt in-app; if it was hard-denied,
  // deep-link to device Settings where the user must flip it on.
  const handleEnableFromBanner = async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.canAskAgain || perm.status === 'undetermined') {
        handleEnableLocation();
      } else {
        Linking.openSettings();
      }
    } catch {
      handleEnableLocation();
    }
  };

  const loadMore = async () => {
    if (loadingMore || posts.length < 20) return;

    setLoadingMore(true);
    try {
      const data =
        activeTab === 'feed'
          ? await getSocialPosts(20, posts.length, blockedIds)
          : await getSwapPosts(20, posts.length, blockedIds, userLocation);

      const postsWithCounts = await enrichPosts(data);

      setPosts((prev) => {
        const next = [...prev, ...postsWithCounts];
        cacheRef.current[activeTab] = next;
        return next;
      });
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleBlockFromFeed = async (userId: string) => {
    if (!session?.user.id) return;
    try {
      await blockUser(session.user.id, userId);
      const newBlocked = [...blockedIds, userId];
      setBlockedIds(newBlocked);
      setPosts((prev) => prev.filter((p) => p.user?.id !== userId));
    } catch (error) {
      console.error('Block error:', error);
      Alert.alert('Error', 'Failed to block user.');
    }
  };

  const handleReportFromFeed = (postId: string) => {
    setReportingPostId(postId);
    setShowReportModal(true);
  };

  const handleReportSubmit = async (reason: string, details: string) => {
    if (!session?.user.id || !reportingPostId) return;
    await reportPost(session.user.id, reportingPostId, reason, details);
    setShowReportModal(false);
    setReportingPostId(null);
    Alert.alert('Report Submitted', 'Thank you. We will review this report.');
  };

  const handleShowNew = () => {
    if (pendingRef.current) {
      cacheRef.current[activeTab] = pendingRef.current;
      setPosts(pendingRef.current);
      pendingRef.current = null;
    }
    setNewAvailable(false);
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTabRef.current) return;
    setNewAvailable(false);
    pendingRef.current = null;
    setActiveTab(tab);
    // Show the cached list for the new tab instantly (no empty flash); the
    // focus effect then refreshes it in the background.
    const cached = cacheRef.current[tab];
    if (cached && cached.length > 0) {
      setPosts(cached);
      setLoading(false);
    } else {
      setPosts([]);
      setLoading(true);
    }
  };

  const handleCardPress = (post: PostWithEngagement) => {
    if (post.post_type === 'swap') {
      navigation.navigate('BookDetail', { postId: post.id });
    } else {
      navigation.navigate('PostDetail', { postId: post.id });
    }
  };

  const handleUserPress = (post: PostWithEngagement) => {
    if (!post.user?.id) return;
    if (post.user.id === session?.user.id) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('OtherUserProfile', { userId: post.user.id });
    }
  };

  const handleLike = async (post: PostWithEngagement) => {
    if (!session) return;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === post.id) {
          return {
            ...p,
            hasLiked: !p.hasLiked,
            likeCount: p.hasLiked ? p.likeCount - 1 : p.likeCount + 1,
          };
        }
        return p;
      })
    );

    try {
      if (post.hasLiked) {
        await unlikePost(post.id, session.user.id);
      } else {
        await likePost(post.id, session.user.id);
      }
    } catch (error) {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === post.id) {
            return {
              ...p,
              hasLiked: post.hasLiked,
              likeCount: post.likeCount,
            };
          }
          return p;
        })
      );
    }
  };

  const renderBookCard = ({ item: post }: { item: PostWithEngagement }) => {
    // For swap posts, show user's uploaded photo
    // For social posts, show book cover from Google Books API
    let imageUrl: string | null = null;
    if (post.post_type === 'swap') {
      imageUrl = post.image_url || post.cover_image_url || null;
    } else {
      imageUrl = post.cover_image_url || post.image_url || null;
    }

    return (
      <View style={{ width: CARD_WIDTH }} className="mb-5">
        {/* User Info on Top */}
        <View className="flex-row items-center mb-2">
          <TouchableOpacity
            onPress={() => handleUserPress(post)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          >
            <Avatar
              avatarUrl={post.user?.avatar_url}
              username={post.user?.username || 'User'}
              size={30}
            />
            <Text style={{ fontSize: 13, fontWeight: '500', marginLeft: 8, flex: 1 }} numberOfLines={1}>
              @{post.user?.username}
            </Text>
          </TouchableOpacity>
          {post.user?.id !== session?.user.id && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(undefined as any, undefined as any, [
                  { text: 'Report Post', onPress: () => handleReportFromFeed(post.id) },
                  {
                    text: 'Block User',
                    style: 'destructive',
                    onPress: () => {
                      if (post.user?.id) {
                        Alert.alert(
                          'Block User',
                          `Block @${post.user.username}? You won't see each other's posts or be able to swap.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Block', style: 'destructive', onPress: () => handleBlockFromFeed(post.user!.id) },
                          ]
                        );
                      }
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              style={{ padding: 4 }}
            >
              <DotsThree size={18} color="#9ca3af" weight="bold" />
            </TouchableOpacity>
          )}
        </View>

        {/* Book Cover - Tappable, hero treatment.
            Outer view casts a soft shadow (no clipping); inner view clips the
            image; spine + edge highlight give a physical-book depth cue. */}
        <TouchableOpacity
          onPress={() => handleCardPress(post)}
          activeOpacity={0.85}
          style={{ marginBottom: 10 }}
        >
          <View
            style={{
              width: CARD_WIDTH,
              height: COVER_HEIGHT,
              borderRadius: 8,
              backgroundColor: '#ffffff',
              shadowColor: '#1e293b',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.18,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <View
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: '#f3f4f6',
              }}
            >
              <BookCover
                coverUrl={post.cover_image_url}
                width={CARD_WIDTH}
                height={COVER_HEIGHT}
                style={{ borderRadius: 8 }}
              />
              {/* spine */}
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(0,0,0,0.12)' }}
              />
              {/* highlight beside the spine */}
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: 3, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(255,255,255,0.16)' }}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Book Title - Dynamic font size */}
        <Text
          style={{ fontSize: getTitleFontSize(post.title) + 1, fontFamily: fonts.serifMedium, color: '#1a1a1a', lineHeight: getTitleFontSize(post.title) + 6, marginBottom: 2, textAlign: 'center' }}
          numberOfLines={2}
        >
          {post.title}
        </Text>

        {/* Author */}
        {post.author && (
          <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 6, textAlign: 'center' }} numberOfLines={1}>
            {post.author}
          </Text>
        )}

        {/* Engagement Buttons - Only for social posts */}
        {post.post_type === 'social' && (
          <View className="flex-row items-center justify-center mt-1">
            {/* Like Button */}
            <TouchableOpacity
              onPress={() => handleLike(post)}
              className="flex-row items-center px-3 py-1"
              activeOpacity={0.7}
            >
              <Heart size={20} color={post.hasLiked ? '#E54B4B' : '#0072DD'} weight={post.hasLiked ? 'fill' : 'regular'} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
                {post.likeCount}
              </Text>
            </TouchableOpacity>

            {/* Spacer */}
            <View className="w-4" />

            {/* Comment Button */}
            <TouchableOpacity
              onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
              className="flex-row items-center px-3 py-1"
              activeOpacity={0.7}
            >
              <ChatCircle size={20} color="#0072DD" weight="regular" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
                {post.commentCount}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Swap type badge + distance + wishlist for swap posts */}
        {post.post_type === 'swap' && (
          <View className="items-center mt-1 gap-1">
            {wishlistTitles.includes(normalizeTitle(post.title)) && (
              <View className="bg-green-100 px-3 py-1.5 rounded-full flex-row items-center" style={{ gap: 4 }}>
                <Bookmark size={12} color="#15803d" weight="fill" />
                <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '700' }}>On your wishlist</Text>
              </View>
            )}
            {post.swap_type && (
              <View className="bg-blue-100 px-3 py-1.5 rounded-full">
                <Text style={{ fontSize: 13, color: '#1d4ed8' }} className="capitalize">{post.swap_type}</Text>
              </View>
            )}
            {post.distance_miles != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <MapPin size={12} color="#6b7280" weight="regular" />
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  {post.distance_miles < 0.1 ? '<0.1' : post.distance_miles.toFixed(1)} mi away
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = (tab: TabType) => {
    const isSwaps = tab === 'swaps';
    const noNearby = isSwaps && userLocation && !locationDenied;

    return (
      <View className="flex-1 items-center justify-center py-20">
        {isSwaps ? (
        <ArrowsClockwise size={50} color="#9ca3af" weight="duotone" style={{ marginBottom: 16 }} />
      ) : (
        <Books size={50} color="#9ca3af" weight="duotone" style={{ marginBottom: 16 }} />
      )}
        <Text style={{ fontSize: 20, fontFamily: fonts.serifMedium, color: '#4b5563', marginBottom: 8 }}>
          {isSwaps ? (noNearby ? 'No nearby swaps' : 'No swaps available') : 'No posts yet'}
        </Text>
        <Text style={{ fontSize: 15, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 32 }}>
          {isSwaps
            ? noNearby
              ? 'No books within 25 miles. Try the seed accounts or post your own!'
              : locationDenied
              ? 'Location is off — showing all swaps. Enable location for nearby results.'
              : 'Post a book to start swapping!'
            : "Be the first to share what you're reading!"}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#38B6FF" />
      </View>
    );
  };

  const goToTab = (tab: TabType) => {
    pagerRef.current?.scrollTo({ x: tab === 'feed' ? 0 : SCREEN_WIDTH, animated: true });
    handleTabChange(tab);
  };

  const renderPage = (tab: TabType) => {
    const isActive = tab === activeTab;
    const pagePosts = isActive ? posts : cacheRef.current[tab];
    const pageLoading = isActive ? loading : !loadedRef.current[tab] && pagePosts.length === 0;

    let body;
    if (pageLoading) {
      body = (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#38B6FF" />
        </View>
      );
    } else if (isActive && error) {
      body = (
        <View className="flex-1 items-center justify-center px-8">
          <WarningCircle size={48} color="#ef4444" weight="duotone" style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 19, fontFamily: fonts.serifSemiBold, color: '#374151', textAlign: 'center', marginBottom: 8 }}>
            Couldn't load {tab === 'feed' ? 'feed' : 'swaps'}
          </Text>
          <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={handleRetry} className="bg-primary px-6 py-3 rounded-xl">
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      body = (
        <>
          {tab === 'feed' && hasPosted === false && !promptDismissed && (
            <View className="mx-4 mt-3 mb-1 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <Text style={{ fontSize: 18, fontFamily: fonts.serifSemiBold, color: '#1e40af', marginBottom: 4 }}>
                Share what you're reading
              </Text>
              <Text style={{ fontSize: 14, color: '#3b82f6', marginBottom: 12 }}>
                Add your first book so other readers can find you. Browse as long as you like first.
              </Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('FirstPost')}
                  className="bg-primary px-5 py-2.5 rounded-xl"
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Add your first book</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPromptDismissed(true)} className="px-4 py-2.5">
                  <Text style={{ color: '#6b7280', fontWeight: '500' }}>Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {tab === 'swaps' && locationPromptNeeded && (
            <View className="mx-4 mt-3 mb-1 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MapPin size={16} color="#1d4ed8" weight="regular" />
                <Text style={{ fontSize: 18, fontFamily: fonts.serifSemiBold, color: '#1e40af' }}>
                  See books near you
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: '#3b82f6', marginBottom: 12 }}>
                Readrr uses your location to show swaps within 25 miles. Your exact location is never shared with other readers.
              </Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={handleEnableLocation}
                  className="bg-primary px-5 py-2.5 rounded-xl"
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Enable location</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setLocationPromptNeeded(false); setLocationDenied(true); }} className="px-4 py-2.5">
                  <Text style={{ color: '#6b7280', fontWeight: '500' }}>Not now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {tab === 'swaps' && userLocation && !locationDenied && pagePosts.length > 0 && (
            <View className="px-4 py-2 bg-blue-50 flex-row items-center justify-center">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MapPin size={12} color="#1d4ed8" weight="regular" /><Text style={{ fontSize: 12, color: '#1d4ed8' }}>Showing nearby swaps within 25 miles</Text></View>
            </View>
          )}
          {tab === 'swaps' && locationDenied && (
            <View className="px-4 py-2 bg-amber-50 flex-row items-center justify-center" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 12, color: '#92400e', textAlign: 'center' }}>
                Location off — showing all swaps.
              </Text>
              <TouchableOpacity onPress={handleEnableFromBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 12, color: '#1d4ed8', fontWeight: '700' }}>Enable location</Text>
              </TouchableOpacity>
            </View>
          )}
          {isActive && newAvailable && (
            <TouchableOpacity
              onPress={handleShowNew}
              activeOpacity={0.85}
              style={{ alignSelf: 'center', marginTop: 8, marginBottom: 2 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#38B6FF',
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  shadowColor: '#1e293b',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <ArrowUp size={14} color="#fff" weight="bold" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  New {tab === 'feed' ? 'posts' : 'swaps'} · pull to refresh
                </Text>
              </View>
            </TouchableOpacity>
          )}
          <FlatList
            data={pagePosts}
            renderItem={renderBookCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{
              justifyContent: 'space-between',
              paddingHorizontal: PADDING,
              gap: GAP,
            }}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: 100,
            }}
            refreshControl={
              <RefreshControl refreshing={isActive && refreshing} onRefresh={handleRefresh} />
            }
            onEndReached={isActive ? loadMore : undefined}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={() => renderEmpty(tab)}
            ListFooterComponent={isActive ? renderFooter : null}
            showsVerticalScrollIndicator={false}
          />
        </>
      );
    }

    return (
      <View key={tab} style={{ width: SCREEN_WIDTH, height: pagerHeight || undefined }}>
        {body}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Image
          source={require('../../../assets/images/logo.png')}
          style={{ width: 100, height: 50 }}
          contentFit="contain"
        />
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={{ position: 'relative', padding: 4 }}
        >
          {unreadNotifications > 0 ? (
            <Bell size={26} color="#38B6FF" weight="fill" />
          ) : (
            <Bell size={26} color="#6b7280" weight="regular" />
          )}
          {unreadNotifications > 0 && (
            <View style={{
              position: 'absolute', top: 0, right: 0,
              backgroundColor: '#ef4444', borderRadius: 8,
              minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200">
        {(['feed', 'swaps'] as const).map((tab, i) => (
          <TouchableOpacity key={tab} onPress={() => goToTab(tab)} className="flex-1 py-3">
            <Text
              style={{
                fontSize: 17,
                fontFamily: fonts.serifSemiBold,
                textAlign: 'center',
                color: activeTab === tab ? '#38B6FF' : '#6b7280',
              }}
            >
              {tab === 'feed' ? 'Feed' : 'Swaps'}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Underline follows the finger while swiping */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: -1,
            left: 0,
            width: SCREEN_WIDTH / 2,
            height: 2,
            backgroundColor: '#38B6FF',
            transform: [
              {
                translateX: scrollX.interpolate({
                  inputRange: [0, SCREEN_WIDTH],
                  outputRange: [0, SCREEN_WIDTH / 2],
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        />
      </View>

      {/* Pages */}
      <Animated.ScrollView
        ref={pagerRef as any}
        horizontal
        pagingEnabled
        bounces={false}
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          handleTabChange(page === 0 ? 'feed' : 'swaps');
        }}
        style={{ flex: 1 }}
        onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
      >
        {renderPage('feed')}
        {renderPage('swaps')}
      </Animated.ScrollView>
      <ReportModal
        visible={showReportModal}
        label="Post"
        onSubmit={handleReportSubmit}
        onCancel={() => { setShowReportModal(false); setReportingPostId(null); }}
      />
    </SafeAreaView>
  );
}
