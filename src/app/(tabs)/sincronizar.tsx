import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton, AppHeader, Page, Tip } from '../../components/ui';
import { useWardrobe } from '../../context/wardrobe';
import { theme } from '../../theme';

export default function SyncScreen() {
  const { items, outfits, sync, syncNow } = useWardrobe();
  const pendingClothes = items.filter((item) => item.syncStatus === 'pending').length;
  const pendingOutfits = outfits.filter((item) => item.syncStatus === 'pending').length;
  const missingPhotos = items.filter((item) => item.remotePhotoPath && !item.localPhotoUri).length;
  const complete = !sync.issues.length && !pendingClothes && !pendingOutfits && !missingPhotos && !!sync.lastSuccess;
  const title = sync.running ? 'Sincronizando…' : complete ? 'Tudo em dia' : 'Seus dados estão no aparelho';

  return <Page>
    <AppHeader onHelp={() => router.push('/guia')} />
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>SEU GUARDA ROUPA CONECTADO</Text>
      <Text style={styles.heading} accessibilityRole="header">Suas peças,{ '\n' }também na nuvem.</Text>
      <Text style={styles.description}>Cadastre e monte looks mesmo sem internet. Quando a conexão voltar, enviamos o que ficou pendente.</Text>
    </View>
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.icon}><MaterialCommunityIcons name={complete ? 'cloud-check-outline' : 'cloud-sync-outline'} size={32} color={theme.colors.primary} /></View>
        <View style={styles.statusCopy}>
          <Text style={styles.cardTitle} accessibilityRole="header" accessibilityLiveRegion="polite">{title}</Text>
          <Text style={styles.small}>{sync.running ? 'Enviando e recebendo roupas, looks e fotos.' : sync.lastSuccess ? `Última sincronização: ${new Date(sync.lastSuccess).toLocaleString('pt-BR')}` : 'A primeira sincronização precisa de internet.'}</Text>
        </View>
      </View>
      <View style={styles.counts}>
        <View style={styles.count}><Text style={styles.number}>{items.length}</Text><Text style={styles.small}>peças no aparelho</Text><Text style={styles.pending}>{pendingClothes} para enviar</Text></View>
        <View style={styles.count}><Text style={styles.number}>{outfits.length}</Text><Text style={styles.small}>looks no aparelho</Text><Text style={styles.pending}>{pendingOutfits} para enviar</Text></View>
      </View>
      {missingPhotos > 0 ? <Text style={styles.small}>{missingPhotos} foto(s) aguardando download para este aparelho.</Text> : null}
      {sync.issues.length ? <View style={styles.notice} accessibilityLiveRegion="polite">{sync.issues.map((issue) => <Text key={issue} style={styles.noticeText}>{issue}</Text>)}</View> : null}
      <ActionButton label={sync.running ? 'Sincronizando…' : 'Sincronizar agora'} icon="sync" loading={sync.running} disabled={sync.running} onPress={() => { void syncNow(); }} />
    </View>
    <View style={styles.identity}>
      <MaterialCommunityIcons name="account-outline" size={26} color={theme.colors.primary} />
      <View style={styles.statusCopy}>
        <Text style={styles.cardTitle}>Acesso anônimo</Text>
        <Text style={styles.small}>Sem e-mail ou senha. Sua sessão é mantida neste aparelho e cada pessoa acessa somente os próprios registros.</Text>
        {sync.userId ? <Text style={styles.identityId} selectable>Identificação: {sync.userId}</Text> : null}
      </View>
    </View>
    <Tip text="Guarde sua sessão: sem uma conta vinculada, reinstalar o aplicativo ou apagar os dados dele pode impedir o acesso ao que foi salvo na nuvem. Cada aparelho cria uma identidade própria." />
  </Page>;
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  heading: { color: theme.colors.ink, fontFamily: theme.fonts.editorial, fontSize: 37, lineHeight: 43, letterSpacing: -0.8 },
  description: { color: theme.colors.muted, fontSize: 15, lineHeight: 24 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: theme.colors.border, gap: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 58, height: 58, borderRadius: 19, backgroundColor: theme.colors.sage, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1, gap: 6 },
  cardTitle: { color: theme.colors.ink, fontWeight: '600', fontSize: 17 },
  small: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
  counts: { flexDirection: 'row', gap: 12 },
  count: { flex: 1, backgroundColor: theme.colors.background, padding: 14, borderRadius: 16, gap: 4 },
  number: { color: theme.colors.primary, fontFamily: theme.fonts.editorial, fontSize: 30 },
  pending: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
  notice: { backgroundColor: theme.colors.sand, borderRadius: 14, padding: 14, gap: 10 },
  noticeText: { color: theme.colors.ink, fontSize: 13, lineHeight: 21 },
  identity: { flexDirection: 'row', gap: 14, paddingHorizontal: 4 },
  identityId: { color: theme.colors.muted, fontSize: 11, lineHeight: 17 },
});
