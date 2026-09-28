# Digital Wardobre

Aplicativo para trabalho de mobile 2 em React Native + Expo para organizar roupas.

## Etapa atual: roupas, looks e armazenamento local

Implementado:

- Expo SDK 57, React Native e TypeScript.
- Navegação por abas com Expo Router: Guarda roupa e Looks.
- Tela de dicas, retorno e tratamento de rota inexistente.
- Interface em português, categorias selecionáveis e estados vazios.
- Tema compartilhado e componentes reutilizáveis.
- Cadastro de roupas, foto pela câmera/galeria, galeria e detalhes.
- Persistência com Expo SQLite e fotos no armazenamento local.
- Validação de campos, tratamento de falhas e testes de persistência.
- Montagem de looks com as fotos dispostas de cima a baixo e acessórios ao lado.
- Seleção por categoria, opção de peça única, lista e detalhes dos looks.
- Looks e suas peças salvos juntos no SQLite, sem duplicar as fotos.

Ainda não implementado: edição/exclusão, autenticação e sincronização. **Não há conexão com o Supabase nesta etapa.**

## Abrir no iPhone com Expo Go

1. Atualize o Expo Go pela App Store. O aplicativo precisa suportar Expo SDK 57.
2. Conecte o iPhone e o computador à mesma rede Wi-Fi.
3. No Windows, abra `INICIAR.cmd` nesta pasta. Como alternativa, execute `pnpm start` no terminal.
4. Escaneie o QR Code exibido no terminal com a câmera do iPhone e abra no Expo Go.
5. Mantenha o terminal e o computador ligados durante o teste.

O iniciador usa o pnpm instalado ou o runtime do Codex deste computador. Não é necessário gerar um aplicativo para a App Store ou usar uma conta Apple Developer nesta etapa. O comando `pnpm ios` tenta abrir um simulador local; no Windows, use o QR Code no iPhone físico.

Se o Windows solicitar acesso à rede para Node.js, permita na rede privada de confiança. Redes de faculdade podem bloquear a comunicação entre dispositivos. Nesse caso, avalie um túnel de desenvolvimento como alternativa.

### Ferramentas

Requer Node.js 22.13 ou posterior compatível com Expo SDK 57, e pnpm. Neste computador foi usado o runtime disponibilizado pelo Codex. Se `pnpm` não for reconhecido no terminal, o iniciador local é:

Instalação em outro computador:

```sh
pnpm install --frozen-lockfile
pnpm start
```

## Comandos

```sh
pnpm start          # Expo e QR para o celular
pnpm web           # Prévia visual no navegador
pnpm typecheck     # Verificação TypeScript
pnpm lint          # Verificação de código
pnpm doctor        # Diagnóstico do Expo
```