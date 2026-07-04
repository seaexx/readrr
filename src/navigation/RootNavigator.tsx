import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { registerForPushNotifications } from '../services/notificationsService';

// Heroicons - Outline (unfocused)
import {
  HomeIcon,
  PlusCircleIcon,
  InboxIcon,
  UserIcon,
  MagnifyingGlassIcon,
} from 'react-native-heroicons/outline';

// Heroicons - Solid (focused)
import {
  HomeIcon as HomeIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  InboxIcon as InboxIconSolid,
  UserIcon as UserIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
} from 'react-native-heroicons/solid';

// Auth Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import SignInScreen from '../screens/auth/SignInScreen';

// Onboarding Screens
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import FirstPostScreen from '../screens/onboarding/FirstPostScreen';

// Main Screens
import FeedScreen from '../screens/main/FeedScreen';
import SearchScreen from '../screens/main/SearchScreen';
import CreatePostScreen from '../screens/main/CreatePostScreen';
import SocialPostScreen from '../screens/main/SocialPostScreen';
import SwapPostScreen from '../screens/main/SwapPostScreen';
import BookDetailScreen from '../screens/main/BookDetailScreen';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import InboxScreen from '../screens/main/InboxScreen';
import ChatScreen from '../screens/main/ChatScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';

// Profile Screens
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import OtherUserProfileScreen from '../screens/profile/OtherUserProfileScreen';

// Stack types
export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  SignIn: undefined;
};

export type OnboardingStackParamList = {
  ProfileSetup: undefined;
  FirstPost: undefined;
};

export type MainTabsParamList = {
  Feed: undefined;
  Search: undefined;
  Swaps: undefined;
  Inbox: { tab?: 'received' | 'sent' } | undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  CreatePost: undefined;
  SocialPost: undefined;
  SwapPost: undefined;
  BookDetail: { postId: string };
  PostDetail: { postId: string };
  EditProfile: undefined;
  OtherUserProfile: { userId: string };
  Inbox: { tab?: 'received' | 'sent' };
  Chat: { swapId: string };
  Notifications: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
    </AuthStack.Navigator>
  );
}

function OnboardingNavigator({ hasProfile }: { hasProfile: boolean }) {
  return (
    <OnboardingStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={hasProfile ? 'FirstPost' : 'ProfileSetup'}
    >
      <OnboardingStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <OnboardingStack.Screen name="FirstPost" component={FirstPostScreen} />
    </OnboardingStack.Navigator>
  );
}

function MainTabs() {
  const session = useAuthStore((state) => state.session);
  const [inboxBadge, setInboxBadge] = useState(0);

  // Fetch inbox badge count (pending requests + unread messages)
  useEffect(() => {
    if (!session?.user.id) return;

    const fetchBadgeCount = async () => {
      try {
        // Count pending swap requests received
        const { count: pendingCount } = await supabase
          .from('swaps')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', session.user.id)
          .eq('status', 'pending');

        // Count unread messages in accepted swaps
        const { data: acceptedSwaps } = await supabase
          .from('swaps')
          .select('id')
          .or(`owner_id.eq.${session.user.id},requester_id.eq.${session.user.id}`)
          .eq('status', 'accepted');

        let unreadCount = 0;
        if (acceptedSwaps && acceptedSwaps.length > 0) {
          const swapIds = acceptedSwaps.map((s) => s.id);
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('swap_id', swapIds)
            .neq('sender_id', session.user.id)
            .eq('is_read', false);
          unreadCount = count || 0;
        }

        setInboxBadge((pendingCount || 0) + unreadCount);
      } catch (error) {
        console.error('Error fetching inbox badge:', error);
      }
    };

    fetchBadgeCount();

    // Subscribe to changes
    const swapsChannel = supabase
      .channel('inbox-badge-swaps')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swaps' },
        () => fetchBadgeCount()
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('inbox-badge-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchBadgeCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(swapsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [session?.user.id]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#38B6FF',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopColor: '#f3f4f6',
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ focused, color, size }) =>
            focused ? (
              <HomeIconSolid color={color} size={size} />
            ) : (
              <HomeIcon color={color} size={size} />
            ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ focused, color, size }) =>
            focused ? (
              <MagnifyingGlassIconSolid color={color} size={size} />
            ) : (
              <MagnifyingGlassIcon color={color} size={size} />
            ),
        }}
      />
      <Tab.Screen
        name="Post"
        component={CreatePostScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('CreatePost');
          },
        })}
        options={{
          tabBarLabel: 'Post',
          tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
          tabBarIcon: ({ color, size }) => (
            <PlusCircleIcon color={color} size={size + 4} />
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarLabel: 'Inbox',
          tabBarBadge: inboxBadge > 0 ? inboxBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', fontSize: 11 },
          tabBarIcon: ({ focused, color, size }) =>
            focused ? (
              <InboxIconSolid color={color} size={size} />
            ) : (
              <InboxIcon color={color} size={size} />
            ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color, size }) =>
            focused ? (
              <UserIconSolid color={color} size={size} />
            ) : (
              <UserIcon color={color} size={size} />
            ),
        }}
      />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="MainTabs" component={MainTabs} />
      <MainStack.Screen name="CreatePost" component={CreatePostScreen} />
      <MainStack.Screen name="SocialPost" component={SocialPostScreen} />
      <MainStack.Screen name="SwapPost" component={SwapPostScreen} />
      <MainStack.Screen name="BookDetail" component={BookDetailScreen} />
      <MainStack.Screen name="PostDetail" component={PostDetailScreen} />
      <MainStack.Screen name="EditProfile" component={EditProfileScreen} />
      <MainStack.Screen name="OtherUserProfile" component={OtherUserProfileScreen} />
      <MainStack.Screen name="Inbox" component={InboxScreen} />
      <MainStack.Screen name="Chat" component={ChatScreen} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const { session, profile, loading, hasPosted, setSession, setLoading, setProfile, setHasPosted } = useAuthStore();

  // Listen for auth changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (!session) {
          setHasPosted(null);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Check user profile and posts
  useEffect(() => {
    if (session?.user) {
      fetchUserProfile(session.user.id);
      checkUserHasPosted(session.user.id);
      registerForPushNotifications(session.user.id);
    } else {
      setHasPosted(null);
      setProfile(null);
    }
  }, [session]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  const checkUserHasPosted = async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;
      setHasPosted((count ?? 0) > 0);
    } catch (error) {
      console.error('Error checking posts:', error);
      setHasPosted(false);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (loading || (session && hasPosted === null)) {
    return <LoadingSpinner fullScreen />;
  }

  // Determine which navigator to show
  const showAuth = !session;
  const showOnboarding = session && (!profile || !hasPosted);
  const showMain = session && profile && hasPosted;

  return (
    <NavigationContainer>
      {showAuth ? (
        <AuthNavigator />
      ) : showOnboarding ? (
        <OnboardingNavigator hasProfile={!!profile} />
      ) : (
        <MainNavigator />
      )}
    </NavigationContainer>
  );
}
