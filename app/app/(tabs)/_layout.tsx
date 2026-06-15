import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/theme';

function icon(emoji: string) {
  return ({ color }: { color: string }) => <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '发现', tabBarIcon: icon('🌍') }} />
      <Tabs.Screen name="friends" options={{ title: '好友', tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="history" options={{ title: '记录', tabBarIcon: icon('🕘') }} />
      <Tabs.Screen name="profile" options={{ title: '我的', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
