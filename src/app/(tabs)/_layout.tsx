import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

import { theme } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.muted,
      tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      tabBarItemStyle: { paddingVertical: 4 },
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Guarda roupa',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="hanger" color={color} size={size} />,
      }} />
      <Tabs.Screen name="looks" options={{
        title: 'Looks',
        tabBarIcon: ({ color, size, focused }) => <MaterialCommunityIcons name={focused ? 'view-grid' : 'view-grid-outline'} color={color} size={size} />,
      }} />
      <Tabs.Screen name="sincronizar" options={{
        title: 'Nuvem',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cloud-sync-outline" color={color} size={size} />,
      }} />
    </Tabs>
  );
}
