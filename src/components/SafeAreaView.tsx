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

  return (
    <View
      {...rest}
      style={[
        {
          paddingTop: e.includes('top') ? insets.top : 0,
          paddingRight: e.includes('right') ? insets.right : 0,
          paddingBottom: e.includes('bottom') ? insets.bottom : 0,
          paddingLeft: e.includes('left') ? insets.left : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
