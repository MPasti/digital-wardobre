import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export function ClothingPhoto({ uri, name, style, resizeMode = 'cover', compact = false, placeholderIcon = 'hanger' }: { uri?: string; name: string; style?: StyleProp<ViewStyle>; resizeMode?: 'cover' | 'contain'; compact?: boolean; placeholderIcon?: ComponentProps<typeof MaterialCommunityIcons>['name'] }) {
  const [failedUri, setFailedUri] = useState<string>();
  const failed = !!uri && failedUri === uri;
  return <View style={[styles.frame, style]}>
    {uri && !failed
      ? <Image source={{ uri }} accessibilityLabel={`Foto de ${name}`} style={StyleSheet.absoluteFill} resizeMode={resizeMode} onError={() => setFailedUri(uri)} />
      : <View style={styles.placeholder} accessibilityLabel={`${name}: ${failed ? 'foto indisponível' : 'sem foto'}`}>
        <MaterialCommunityIcons name={placeholderIcon} size={compact ? 23 : 38} color={theme.colors.primary} />
        {!compact ? <Text style={styles.label}>{failed ? 'Foto indisponível' : 'Sem foto'}</Text> : null}
      </View>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 1, width: '100%', backgroundColor: theme.colors.sage, overflow: 'hidden', borderRadius: 16 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { color: theme.colors.muted, fontSize: 12 },
});
