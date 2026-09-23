import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets, Edge } from 'react-native-safe-area-context';

interface Props extends ViewProps {
  edges?: readonly Edge[];
  className?: string;
}

// Drop-in replacement for react-native-safe-area-context's <SafeAreaView>.
// That native component applies its insets only after layout, so every screen
// drew its first frame flush with the top and then snapped down by the status
// bar height — screens looked like they slid in from the top. The insets hook
// reads from the provider (seeded with initialWindowMetrics), so padding is
// correct on the very first frame. React Navigation recommends this approach.
export default function SafeAreaView({ edges, style, children, ...rest }: Props) {
  const insets = useSafeAreaInsets();
  const e = edges ?? ['top', 'right', 'bottom', 'left'];

  // Only set padding for edges that actually have an inset. Writing an explicit
  // 0 would override className padding (e.g. `px-6` on BookFinder), which made
  // those screens lose their side margins.
  const insetStyle: Record<string, number> = {};
  if (e.includes('top') && insets.top) insetStyle.paddingTop = insets.top;
  if (e.includes('bottom') && insets.bottom) insetStyle.paddingBottom = insets.bottom;
  if (e.includes('left') && insets.left) insetStyle.paddingLeft = insets.left;
  if (e.includes('right') && insets.right) insetStyle.paddingRight = insets.right;

  return (
    <View
      {...rest}
      style={[insetStyle, style]}
    >
      {children}
    </View>
  );
}
