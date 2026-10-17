# Pontos em aberto

- [ ] Forma de conexão com o ERP e campos de títulos/baixas (Ryan).
- [ ] O cadastro de clientes já tem latitude/longitude ou será preciso geocodificar endereços?
- [ ] As rotas seguem as praças/rotas do ERP ou serão desenhadas no mapa pelo analista?
- [ ] O motoqueiro vai receber dinheiro em mãos ou só Pix/boleto? Como é a prestação de contas?
- [ ] Qual a capacidade normal de visitas por motoqueiro por dia?
- [ ] Tolerância em dias para considerar uma promessa quebrada.
- [ ] Raio de GPS aceito no check-in.
- [ ] App nativo (React Native) ou PWA no navegador do celular?
- [ ] Serviço de mapa: Google Maps (pago por uso) ou Mapbox/OpenStreetMap?
- [ ] Produto da Intelipulse para vários clientes ou sistema sob medida para uma empresa?
- [ ] Consentimento e aviso aos motoqueiros sobre rastreamento de localização (LGPD), só durante a rota.
- [ ] Banco: confirmar o padrão de colunas, a RLS e a ligação com empresa e usuário do `EFR_ecommerce_tirapedidos` (ver [banco de dados e padrão](11-banco-de-dados-padrao.md)).
- [ ] Banco: o plano Free/Nano pausa por inatividade e é pequeno para o rastreamento em tempo real; avaliar plano pago antes de produção.
- [ ] O devedor da cobrança é o `tb04_cliente` do e-commerce ou uma tabela nova no grupo `int`?
