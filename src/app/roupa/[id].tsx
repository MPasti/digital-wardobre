import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton, EmptyState, Page } from '../../components/ui';
import { ClothingPhoto } from '../../components/clothing-photo';
import { useWardrobe } from '../../context/wardrobe';
import { theme } from '../../theme';
import { clothingCategories } from '../../types/wardrobe';

export default function ClothingDetailsScreen() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const { items } = useWardrobe();
  const item = items.find((entry) => entry.id === id);
  if (!item) return <Page>
    <Stack.Screen options={{ title: 'Peça não encontrada', headerShown: true }} />
    <EmptyState icon="hanger" title="Não encontramos essa peça." description="Ela não está neste guarda-roupa local.">
      <ActionButton label="Voltar ao guarda roupa" onPress={() => router.navigate('/')} />
    </EmptyState>
  </Page>;
  const category = clothingCategories.find((entry) => entry.id === item.category)?.label;
  return <Page>
    <Stack.Screen options={{ title: 'Sua peça', headerShown: true }} />
    {saved === '1' ? <View style={styles.success} accessibilityRole="alert"><Text style={styles.successText}>Peça salva no aparelho!</Text></View> : null}
    <ClothingPhoto uri={item.localPhotoUri} name={item.name} style={styles.photo} />
    {item.localPhotoPath && !item.localPhotoUri ? <Text style={styles.muted}>Não foi possível abrir a foto. Os dados da peça continuam salvos.</Text> : null}
    <View style={styles.titleGroup}>
      <Text style={styles.category}>{category}</Text>
      <Text style={styles.title} accessibilityRole="header">{item.name}</Text>
      <Text style={styles.color}>Cor: {item.color}</Text>
    </View>
    {item.notes ? <View style={styles.notes}><Text style={styles.label}>Observações</Text><Text style={styles.body}>{item.notes}</Text></View> : null}
    <Text style={styles.muted}>Adicionada em {new Date(item.createdAt).toLocaleDateString('pt-BR')}. Disponível neste aparelho.</Text>
    <ActionButton label="Ver meu guarda roupa" icon="hanger" onPress={() => router.navigate('/')} />
    <ActionButton label="Cadastrar outra peça" icon="plus" secondary onPress={() => router.replace('/nova-roupa')} />
  </Page>;
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 3, borderRadius: 24 },
  success: { backgroundColor: theme.colors.sage, padding: 16, borderRadius: 16 }, successText: { color: theme.colors.primary, fontWeight: '600', textAlign: 'center' },
  titleGroup: { gap: 10 }, category: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  title: { fontFamily: theme.fonts.editorial, fontSize: 34, lineHeight: 41, color: theme.colors.ink },
  color: { color: theme.colors.ink, fontSize: 16 },
  notes: { backgroundColor: theme.colors.surface, padding: 20, borderRadius: 20, gap: 8 }, label: { fontWeight: '700', color: theme.colors.ink, fontSize: 15 },
  body: { color: theme.colors.ink, fontSize: 15, lineHeight: 24 }, muted: { color: theme.colors.muted, fontSize: 13, lineHeight: 21 },
});
