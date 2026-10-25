# Checklist de homologação em produção (§27.8)

Executar **na URL real da Vercel**, não em localhost. Marque cada item. Pré-condição: deploy efetuado
(hoje **pendente** — requer acesso à conta Vercel, §27.9).

| # | Verificação | Como validar | OK |
|---|---|---|----|
| 1 | Carregamento inicial e navegação | Abrir a URL; alternar Modo rápido ↔ avançado; dados preservados | ☐ |
| 2 | Refresh em rotas internas e links diretos | Dar refresh na página; abrir link direto — SPA fallback serve `index.html` (ver `vercel.json`) | ☐ |
| 3 | Seleção dos 5 módulos e complexidade | Marcar/desmarcar módulos; conferir aviso de dependência (Engajamento sem Pontos) e score | ☐ |
| 4 | Pricing Engine e conciliação | Conferir que Setup, mensalidade e TCV do dashboard = pré-visualização = PDF; margem 70%/60% coerente | ☐ |
| 5 | Visão interna × externa | Alternar audiência; a externa oculta custos/margens/fees; o PDF idem | ☐ |
| 6 | Geração, visualização e download do PDF | Pré-visualizar → conferir → confirmar → gerar; abrir o PDF em Chrome/Safari/Firefox | ☐ |
| 7 | Light/Dark, desktop e mobile | Trocar tema; testar em viewport mobile; sem quebra de layout | ☐ |
| 8 | Salvamento e recuperação | Recarregar a página e confirmar que a configuração persiste (localStorage, Cenário A) | ☐ |
| 9 | Console e logs sem erros críticos | DevTools → Console limpo; sem exceções no carregamento/geração de PDF | ☐ |
| 10 | Variáveis e ausência de segredos no bundle | Inspecionar o bundle: nenhum token/credencial; nenhuma `VITE_*` sensível | ☐ |
| 11 | Preview e Production | Abrir um PR → deploy de Preview; promover para Production; ambos acessíveis | ☐ |
| 12 | Rollback documentado e verificável | Executar o rollback (ver `docs/02`) num deploy de teste e revalidar itens 1–4 | ☐ |

## Casos críticos do Pricing Engine a conferir (item 4)

Entradas padrão (50.000 usuários, MAU 40%, stickiness 15%, 1 tx/MAU, NF 10%×1, comunicação fallback,
opção Recomendado, 12 meses, via Minu) devem produzir:

| Indicador | Valor esperado |
|---|---|
| Tier | Growth |
| Platform Fee de tabela | R$ 24.625 |
| Core MRR | ≈ R$ 37.825 |
| Margem técnica | ≈ 70,5% (SAUDÁVEL) |
| TCV ao cliente (12m) | ≈ R$ 525.900 |
| Identificador | BONDLY-2027-000001 (1ª proposta do navegador) |

Esses números coincidem com o simulador HTML V1.0 (paridade provada em `parity.test.ts`).

## Evidências a anexar

- Print da URL de produção carregada (tema claro e escuro).
- PDF de uma proposta de teste (`BONDLY-2027-NNNNNN`).
- Saída de `npm run test` (40 testes verdes) e `npm run build` (sem warning de chunk).
- Registro do deploy: commit, data e URL.
