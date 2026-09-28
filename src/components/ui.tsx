import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ComponentProps, PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Page({ children, withHeader = false }: PropsWithChildren<{ withHeader?: boolean }>) {
  return (
    <SafeAreaView style={styles.safe} edges={withHeader ? ['left', 'right', 'bottom'] : ['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AppHeader({ onHelp }: { onHelp: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <MaterialCommunityIcons name="hanger" size={23} color={theme.colors.white} />
        </View>
        <Text style={styles.brandName}>Digital Wardobre</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir guia do guarda roupa"
        onPress={onHelp}
        style={({ pressed }) => [styles.help, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="information-outline" size={23} color={theme.colors.ink} />
      </Pressable>
    </View>
  );
}

export function ActionButton({ label, onPress, icon = 'arrow-right', secondary = false, disabled = false, loading = false }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [styles.button, disabled && { opacity: 0.55 }, secondary && styles.secondary, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
      {loading ? <ActivityIndicator color={theme.colors.white} /> : <MaterialCommunityIcons name={icon} size={20} color={secondary ? theme.colors.primary : theme.colors.white} />}
    </Pressable>
  );
}

export function EmptyState({ icon, title, description, children }: PropsWithChildren<{
  icon: IconName;
  title: string;
  description: string;
}>) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={42} color={theme.colors.primary} />
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

export function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tip}>
      <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={theme.colors.primary} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  page: { padding: 24, paddingBottom: 36, gap: 24, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandIcon: { width: 38, height: 38, backgroundColor: theme.colors.primary, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: theme.colors.ink, fontSize: 19, fontWeight: '700', letterSpacing: -0.5, flexShrink: 1 },
  help: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 52, backgroundColor: theme.colors.primary, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { color: theme.colors.white, fontWeight: '600', fontSize: 15, flexShrink: 1 },
  secondary: { backgroundColor: theme.colors.sage },
  secondaryText: { color: theme.colors.primary },
  pressed: { opacity: 0.7 },
  empty: { backgroundColor: theme.colors.surface, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 30, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 14 },
  emptyIcon: { width: 84, height: 84, borderRadius: 28, backgroundColor: theme.colors.sage, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: theme.colors.ink, fontSize: 27, lineHeight: 34, fontFamily: theme.fonts.editorial, textAlign: 'center' },
  description: { color: theme.colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 350 },
  actions: { marginTop: 8, width: '100%', gap: 12 },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: 4 },
  tipText: { flex: 1, color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
});
