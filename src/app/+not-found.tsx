import { router, Stack } from 'expo-router';

import { ActionButton, EmptyState, Page } from '../components/ui';

export default function NotFoundScreen() {
  return (
    <Page>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <EmptyState icon="hanger" title="Esse caminho não existe." description="Volte ao seu guarda roupa para continuar.">
        <ActionButton label="Ir ao guarda roupa" onPress={() => router.replace('/')} />
      </EmptyState>
    </Page>
  );
}
