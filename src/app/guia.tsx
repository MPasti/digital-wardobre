import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Page } from '../components/ui';
import { theme } from '../theme';

const tips = [
  { number: '01', title: 'Olhe para o que você já tem', description: 'Separe algumas peças que usa bastante. Observe as cores, os formatos e as ocasiões em que gosta de usá-las.' },
  { number: '02', title: 'Prepare boas fotos', description: 'Fotografe uma peça por vez, com boa luz e fundo simples. Deixe a roupa inteira visível para enxergar seus detalhes.' },
  { number: '03', title: 'Experimente combinações', description: 'Escolha uma peça principal e procure outras que você goste de usar com ela. Pense também em calçados e acessórios.' },
];

export default function GuideScreen() {
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Page>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SEU GUARDA ROUPA NO SEU BOLSO</Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Fechar guia" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="close" size={24} color={theme.colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.title} accessibilityRole="header">Pequenos passos,{ '\n' }novas possibilidades.</Text>
      <Text style={styles.subtitle}>Comece com calma. O melhor guarda roupa é aquele que faz sentido para a sua rotina.</Text>
      <View style={styles.cards}>
        {tips.map((tip) => (
          <View key={tip.number} style={styles.card}>
            <Text style={styles.number}>{tip.number}</Text>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle} accessibilityRole="header">{tip.title}</Text>
              <Text style={styles.description}>{tip.description}</Text>
            </View>
          </View>
        ))}
      </View>
      <ActionButton label="Voltar para o aplicativo" onPress={close} icon="arrow-left" />
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { flex: 1, fontSize: 10, letterSpacing: 1.6, fontWeight: '700', color: theme.colors.primary, lineHeight: 17 },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: theme.colors.sage },
  pressed: { opacity: 0.7 },
  title: { color: theme.colors.ink, fontFamily: theme.fonts.editorial, fontSize: 35, lineHeight: 42, letterSpacing: -0.8 },
  subtitle: { color: theme.colors.muted, fontSize: 15, lineHeight: 24 },
  cards: { gap: 14 },
  card: { flexDirection: 'row', gap: 16, backgroundColor: theme.colors.surface, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: theme.colors.border },
  number: { color: theme.colors.primary, fontFamily: theme.fonts.editorial, fontSize: 26 },
  cardCopy: { flex: 1, gap: 8 },
  cardTitle: { color: theme.colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  description: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 },
});
