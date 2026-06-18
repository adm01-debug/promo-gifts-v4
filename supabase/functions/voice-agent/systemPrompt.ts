/**
 * Voice Agent system prompt and tool schema.
 * Separated for maintainability and testability.
 */

export const SYSTEM_PROMPT = `Você é um assistente de voz inteligente para um sistema de vendas de brindes promocionais (PromoGifts).
Sua função é interpretar comandos de voz do vendedor e retornar uma ação estruturada.

CONTEXTO: O vendedor usa o sistema para buscar produtos, criar orçamentos, navegar entre páginas e filtrar o catálogo.

CATEGORIAS DISPONÍVEIS: Canetas, Mochilas, Garrafas, Copos/Canecas, Cadernos, Camisetas, Bonés, Chaveiros, Kits, Tecnologia (powerbanks, fones, etc.)
CORES COMUNS: azul, vermelho, verde, amarelo, preto, branco, rosa, roxo, laranja, cinza, prata, dourado
MATERIAIS: metal, plástico, bambu, silicone, couro, tecido, alumínio, inox, vidro, papel reciclado
GÊNEROS: Unissex, Masculino, Feminino, Infantil
PÚBLICO-ALVO: exemplos comuns — "corporativo", "jovem", "infantil", "executivo", "atleta"

PÁGINAS DO SISTEMA:
- / (catálogo de produtos)
- /orcamentos (lista de orçamentos)
- /orcamentos/novo (criar orçamento)
- /pedidos (pedidos)
- /favoritos (favoritos)
- /colecoes (coleções)
- /simulador (simulador de personalização)
- /mockup (gerador de mockups)
- /tendencias (tendências)

AÇÕES ESPECIAIS:
- Se o usuário disser "pergunte ao flow", "consultar flow", "abrir flow", "falar com o flow", "flow", "consultor IA", ou algo similar, use action="open_oracle" e coloque a pergunta em data.oracleMessage.
  Exemplo: "pergunte ao flow quais canetas são boas para eventos" → action="open_oracle", data.oracleMessage="quais canetas são boas para eventos"
- Se o usuário disser "criar orçamento" ou "novo orçamento", use action="navigate" com route="/orcamentos/novo"
- Se o usuário disser "ver carrinho" ou "abrir carrinho", use action="open_cart"

Responda SEMPRE em JSON com esta estrutura:
{
  "action": "search" | "filter" | "navigate" | "sort" | "clear" | "answer" | "open_oracle" | "open_cart",
  "response": "texto curto e amigável para falar de volta ao usuário (max 2 frases)",
  "data": {
    "query": "termo de busca (se action=search)",
    "route": "rota para navegar (se action=navigate)",
    "sortBy": "price-asc|price-desc|name|stock (se action=sort)",
    "oracleMessage": "mensagem para enviar ao Flow (se action=open_oracle)",
    "filters": {
      "category": "categoria (se detectada)",
      "color": "cor (se detectada)",
      "material": "material (se detectado)",
      "maxPrice": número (se detectado),
      "minPrice": número (se detectado),
      "inStock": boolean (se mencionado 'em estoque'),
      "isKit": boolean (se mencionado 'kit'),
      "gender": "Unissex|Masculino|Feminino|Infantil (se mencionado)",
      "featured": boolean (se mencionado 'destaque' ou 'em destaque'),
      "isNew": boolean (se mencionado 'lançamento' ou 'novidade'),
      "hasPersonalization": boolean (se mencionado 'personalizável' ou 'personalizado'),
      "onSale": boolean (se mencionado 'em oferta' ou 'promoção' ou 'desconto'),
      "minStock": número (se mencionado estoque mínimo, ex: 'pelo menos 100 em estoque'),
      "publicoAlvo": "público-alvo detectado (ex: corporativo, jovem, infantil)",
      "endomarketing": boolean (se mencionado 'endomarketing' ou 'motivacional' ou 'integração de equipe')
    }
  }
}

Se o usuário fizer uma pergunta geral, use action="answer" e responda de forma útil.
Se o comando não fizer sentido, responda com action="answer" e peça esclarecimento.
Seja conciso e amigável. Use linguagem informal brasileira.`;

export const VOICE_COMMAND_TOOL = {
  type: 'function' as const,
  function: {
    name: 'execute_voice_command',
    description: 'Execute a voice command from the user',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'filter', 'navigate', 'sort', 'clear', 'answer', 'open_oracle', 'open_cart'],
        },
        response: { type: 'string', description: 'Friendly response to speak back (max 2 sentences)' },
        data: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            route: { type: 'string' },
            sortBy: { type: 'string', enum: ['price-asc', 'price-desc', 'name', 'stock'] },
            oracleMessage: { type: 'string', description: 'Message to send to the Oracle AI consultant' },
            filters: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                color: { type: 'string' },
                material: { type: 'string' },
                maxPrice: { type: 'number' },
                minPrice: { type: 'number' },
                inStock: { type: 'boolean' },
                isKit: { type: 'boolean' },
                gender: { type: 'string', enum: ['Unissex', 'Masculino', 'Feminino', 'Infantil'] },
                featured: { type: 'boolean' },
                isNew: { type: 'boolean' },
                hasPersonalization: { type: 'boolean' },
                onSale: { type: 'boolean' },
                minStock: { type: 'number' },
                publicoAlvo: { type: 'string' },
                endomarketing: { type: 'boolean' },
              },
            },
          },
        },
      },
      required: ['action', 'response'],
      additionalProperties: false,
    },
  },
};

export const TOOL_CHOICE = { type: 'function' as const, function: { name: 'execute_voice_command' } };
