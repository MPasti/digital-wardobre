import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, AppHeader, Page, Tip } from '../../components/ui';
import { useWardrobe } from '../../context/wardrobe';
import { accountError } from '../../services/account-link';
import { theme } from '../../theme';

export default function AccountScreen() {
  const { account, accountBusy, register, signIn, confirmAccount, resendEmail, changeEmail, signOut, useAnonymous } = useWardrobe();
  const [mode, setMode] = useState<'register' | 'login'>(account.signedOut ? 'login' : 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [useCode, setUseCode] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const pending = !!account.pendingEmail;
  const connected = !!account.id && !account.anonymous && !account.signedOut && !pending;
  const creating = mode === 'register' || pending;
  const busy = working || accountBusy;

  async function perform(action: () => Promise<unknown>, success = '', clearPassword = true) {
    if (busy) return;
    setWorking(true); setError(''); setMessage('');
    try { await action(); setMessage(success); }
    catch (cause) { setError(accountError(cause)); }
    finally { setWorking(false); if (clearPassword) { setPassword(''); setConfirmation(''); } }
  }

  function submit() {
    if (creating && password !== confirmation) { setError('As senhas precisam ser iguais.'); return; }
    void perform(async () => {
      if (pending) await confirmAccount(password, useCode ? code : undefined);
      else if (mode === 'register') await register(email, password);
      else await signIn(email, password);
    }, '', pending || mode === 'login');
  }

  return <Page>
    <AppHeader onHelp={() => router.push('/guia')} />
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>SUA CONTA</Text>
      <Text style={styles.heading} accessibilityRole="header">Seu guarda roupa,{ '\n' }com você.</Text>
      <Text style={styles.description}>{connected ? 'Suas peças e seus looks estão vinculados à sua conta.' : 'Crie uma conta para acessar suas peças e seus looks com e-mail e senha.'}</Text>
    </View>

    <View style={styles.card}>
      {connected ? <>
        <View style={styles.identity}>
          <MaterialCommunityIcons name="account-check-outline" color={theme.colors.primary} size={34} />
          <View style={styles.copy}><Text style={styles.title}>Você está conectado</Text><Text style={styles.description} selectable>{account.email}</Text></View>
        </View>
        <Text style={styles.small}>O que você cadastrar aqui pertence a esta conta. A sessão continua salva ao fechar o aplicativo.</Text>
        <ActionButton label="Ir para meu guarda roupa" icon="hanger" onPress={() => router.replace('/')} />
        <ActionButton label="Sair da conta" icon="logout" secondary disabled={busy} onPress={() => { void perform(signOut); }} />
      </> : <>
        {pending ? <>
          <Text style={styles.title}>Confirme seu e-mail</Text>
          <Text style={styles.description}>Abra o link enviado para {account.pendingEmail}. Depois, volte a esta tela e toque em Concluir cadastro.</Text>
          <Text style={styles.small}>Se o navegador não abrir a página de retorno, volte mesmo assim: o app verifica se o e-mail foi confirmado.</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setUseCode((value) => !value)} style={styles.codeToggle}><Text style={styles.selectedText}>{useCode ? 'Usar confirmação pelo link' : 'Recebi um código por e-mail'}</Text></Pressable>
          {useCode ? <View style={styles.field}><Text style={styles.label}>Código do e-mail</Text>
            <TextInput accessibilityLabel="Código do e-mail" style={styles.input} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="Opcional se já confirmou pelo link" editable={!busy} />
          </View> : null}
        </> : <>
          <View style={styles.switcher}>
            {(['register', 'login'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }} disabled={busy} onPress={() => { setMode(value); setError(''); setMessage(''); setPassword(''); setConfirmation(''); }} style={[styles.switch, mode === value && styles.selected]}>
              <Text style={[styles.switchText, mode === value && styles.selectedText]}>{value === 'register' ? 'Criar conta' : 'Entrar'}</Text>
            </Pressable>)}
          </View>
          <View style={styles.field}><Text style={styles.label}>E-mail</Text>
            <TextInput accessibilityLabel="E-mail" style={styles.input} value={email} onChangeText={setEmail} placeholder="voce@exemplo.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
          </View>
        </>}
        <View style={styles.field}><Text style={styles.label}>{creating ? 'Crie sua senha' : 'Senha'}</Text>
          <TextInput accessibilityLabel="Senha" style={styles.input} value={password} onChangeText={setPassword} placeholder={creating ? 'Pelo menos 8 caracteres' : 'Sua senha'} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={creating ? 'new-password' : 'current-password'} editable={!busy} />
        </View>
        {creating ? <View style={styles.field}><Text style={styles.label}>Repita a senha</Text>
          <TextInput accessibilityLabel="Repita a senha" style={styles.input} value={confirmation} onChangeText={setConfirmation} placeholder="Digite a senha novamente" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy} />
        </View> : null}
        <ActionButton label={pending ? 'Concluir cadastro' : creating ? 'Criar minha conta' : 'Entrar na conta'} icon={creating ? 'account-plus-outline' : 'login'} disabled={busy} loading={busy} onPress={submit} />
        {pending ? <>
          <ActionButton label="Reenviar confirmação" icon="email-sync-outline" secondary disabled={busy} onPress={() => { void perform(resendEmail, 'Confirmação reenviada. Confira sua caixa de entrada.', false); }} />
          <ActionButton label="Alterar e-mail" icon="pencil-outline" secondary disabled={busy} onPress={() => { void perform(changeEmail); }} />
        </> : <Text style={styles.small}>{creating ? 'Criar a conta mantém as roupas e os looks do seu acesso anônimo atual.' : 'Ao entrar, você verá o guarda roupa daquela conta. As peças do acesso anônimo ficam separadas neste aparelho.'}</Text>}
        {account.signedOut ? <ActionButton label="Continuar sem cadastro" icon="account-outline" secondary disabled={busy} onPress={() => { void perform(useAnonymous); }} /> : null}
      </>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.small}>{message}</Text> : null}
    </View>
    <Tip text={connected ? 'Entre com esta conta em outro aparelho para baixar o que já foi sincronizado. A aba Nuvem mostra os envios pendentes.' : 'Você ainda pode usar o app sem cadastro. Vincule uma conta antes de trocar de aparelho ou apagar os dados do aplicativo.'} />
  </Page>;
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  heading: { color: theme.colors.ink, fontFamily: theme.fonts.editorial, fontSize: 37, lineHeight: 43, letterSpacing: -0.8 },
  description: { color: theme.colors.muted, fontSize: 15, lineHeight: 24 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: theme.colors.border, gap: 20 },
  title: { color: theme.colors.ink, fontSize: 20, fontWeight: '600' },
  identity: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  copy: { flex: 1, gap: 4 },
  field: { gap: 8 },
  label: { color: theme.colors.ink, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: theme.colors.background, color: theme.colors.ink, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, minHeight: 50 },
  switcher: { flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: 13, padding: 4 },
  switch: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  selected: { backgroundColor: theme.colors.sage },
  switchText: { color: theme.colors.muted, fontSize: 14, fontWeight: '600' },
  selectedText: { color: theme.colors.primary },
  codeToggle: { minHeight: 44, justifyContent: 'center' },
  small: { color: theme.colors.muted, fontSize: 13, lineHeight: 21 },
  error: { color: '#9B3030', backgroundColor: '#FBEDED', padding: 14, borderRadius: 12, fontSize: 14, lineHeight: 21 },
});
