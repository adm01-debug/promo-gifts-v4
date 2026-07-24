# QA Checklist — Perfil do Usuário

## Escopo
Validar fluxos de:
- alteração de dados pessoais;
- alteração de senha;
- alteração de preferências;
- persistência após reload/login;
- mensagens de sucesso/erro;
- restrições de campos imutáveis.

## Pré-condições
- Usuário autenticado com acesso à tela de perfil.
- Conta de teste com e-mail real para confirmar notificações, quando aplicável.
- Ambiente com backend acessível.

## Cenários

### 1) Dados pessoais — sucesso
1. Abrir tela de perfil.
2. Alterar nome e telefone.
3. Salvar.
4. Validar toast/mensagem de sucesso.
5. Recarregar página.
6. Confirmar que dados persistiram.

**Esperado**
- Mensagem de sucesso exibida.
- Dados continuam alterados após reload.

### 2) Dados pessoais — erro de validação
1. Informar e-mail inválido (ex: `abc`).
2. Tentar salvar.

**Esperado**
- Exibição de erro claro de validação no campo.
- Alteração não deve ser persistida.

### 3) Senha — sucesso
1. Informar senha atual válida.
2. Informar nova senha forte + confirmação idêntica.
3. Salvar.
4. Validar mensagem de sucesso.
5. Efetuar logout/login com a nova senha.

**Esperado**
- Mensagem de sucesso.
- Login funciona com nova senha.
- Login com senha antiga falha.

### 4) Senha — erros
4.1 Senha atual incorreta.
- Esperado: erro de credencial e sem alteração.

4.2 Nova senha fraca.
- Esperado: bloqueio por política (tamanho/complexidade).

4.3 Confirmação divergente.
- Esperado: erro de confirmação e sem alteração.

### 5) Preferências — sucesso e persistência
1. Alterar preferências (tema, notificações, etc.).
2. Salvar.
3. Validar mensagem de sucesso.
4. Recarregar página e relogar.

**Esperado**
- Preferências persistidas em reload e novo login.

### 6) Preferências — erro de backend
1. Simular indisponibilidade de rede/backend.
2. Tentar salvar preferências.

**Esperado**
- Mensagem de erro amigável.
- Estado local não deve indicar sucesso falso.

### 7) Campos imutáveis
1. Verificar campos marcados como imutáveis (ex.: e-mail corporativo, ID, CPF, role etc., conforme regra de negócio).
2. Tentar editar via UI.
3. Se possível, tentar envio manual alterando payload (DevTools).

**Esperado**
- UI bloqueia edição (disabled/readonly).
- Backend rejeita mutação de campo imutável com erro apropriado.
- Valor permanece inalterado após reload.

## Evidências mínimas
- Captura da tela de sucesso por fluxo (dados, senha, preferências).
- Captura da tela de erro por fluxo.
- Registro da persistência (antes/depois do reload).
- Registro do bloqueio de campo imutável (UI + resposta de API).

## Critérios de aceite
- Todos os fluxos de sucesso e erro acima validados.
- Nenhum campo imutável alterável via UI/API.
- Persistência consistente entre sessão atual e novo login.
