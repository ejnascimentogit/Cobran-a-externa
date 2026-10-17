// Dados de teste (fictícios) no lugar da integração com o ERP, que é do Ryan.
// Os vencimentos são relativos a "hoje" para a demonstração sempre ter títulos em cada faixa.
import { hojeISO, somaDias } from './formato.js';

const DEPOSITO = { lat: -23.5505, lng: -46.6333, nome: 'Empresa (saída e retorno)' };

// [cod, nome, praça, endereço, lat, lng, telefone, [[dias em atraso, valor], ...]]
const CLIENTES = [
  ['1001', 'Mercadinho Boa Vista', 'Centro', 'Rua das Flores, 120', -23.5431, -46.6392, '(11) 3000-0001', [[4, 850.5], [4, 320]]],
  ['1002', 'Padaria Pão Quente', 'Centro', 'Av. Brasil, 455', -23.5489, -46.6277, '(11) 3000-0002', [[5, 410]]],
  ['1003', 'Auto Peças Veloz', 'Centro', 'Rua do Comércio, 88', -23.5562, -46.6411, '(11) 3000-0003', [[8, 1980], [3, 640]]],
  ['1004', 'Restaurante Sabor Caseiro', 'Centro', 'Rua XV, 301', -23.5398, -46.6335, '(11) 3000-0004', [[9, 1240]]],
  ['1005', 'Farmácia Vida', 'Zona Norte', 'Av. Norte, 1500', -23.5121, -46.6244, '(11) 3000-0005', [[7, 560], [12, 900]]],
  ['1006', 'Loja de Tintas Colorir', 'Zona Norte', 'Rua das Palmeiras, 77', -23.5033, -46.6361, '(11) 3000-0006', [[14, 2310]]],
  ['1007', 'Oficina do Zé', 'Zona Norte', 'Rua Aurora, 12', -23.5187, -46.6102, '(11) 3000-0007', [[18, 780], [18, 1290]]],
  ['1008', 'Supermercado Economia', 'Zona Norte', 'Av. Cruzeiro, 900', -23.4989, -46.6188, '(11) 3000-0008', [[6, 4150]]],
  ['1009', 'Papelaria Estudante', 'Zona Sul', 'Rua da Escola, 45', -23.5851, -46.6479, '(11) 3000-0009', [[15, 365]]],
  ['1010', 'Material de Construção Forte', 'Zona Sul', 'Av. Sul, 2200', -23.6012, -46.6334, '(11) 3000-0010', [[22, 5890], [30, 2100]]],
  ['1011', 'Pet Shop Amigo Fiel', 'Zona Sul', 'Rua dos Animais, 9', -23.5937, -46.6215, '(11) 3000-0011', [[11, 690]]],
  ['1012', 'Lanchonete Ponto Certo', 'Zona Sul', 'Rua Vila Nova, 310', -23.5779, -46.6551, '(11) 3000-0012', [[25, 480]]],
  ['1013', 'Distribuidora Central', 'Centro', 'Rua do Atacado, 1000', -23.5603, -46.6203, '(11) 3000-0013', [[40, 7300]]],
  ['1014', 'Eletrônicos Alfa', 'Centro', 'Rua da Tecnologia, 15', -23.5459, -46.6501, '(11) 3000-0014', [[2, 1500]]],
];

const MOTIVOS = [
  ['Pagou no ato', 'pago'], ['Prometeu pagar', 'promessa'], ['Negociou parcelamento', 'negociado'],
  ['Cliente ausente / estabelecimento fechado', 'sem_sucesso'], ['Recusou pagar', 'sem_sucesso'],
  ['Contesta o débito', 'sem_sucesso'], ['Endereço não localizado', 'sem_sucesso'], ['Dificuldade financeira', 'sem_sucesso'],
];

export function seed() {
  const hoje = hojeISO();
  const titulos = [];
  CLIENTES.forEach(([cod, , , , , , , ts]) =>
    ts.forEach(([atraso, valor], i) =>
      titulos.push({
        codTitulo: `T${cod}-${i + 1}`, codCliente: cod, vencimento: somaDias(hoje, -atraso),
        valor, valorAberto: valor, situacaoErp: 'aberto', dataPagamento: null,
      })));
  return {
    demoData: hoje,
    config: {
      deposito: DEPOSITO, raioGpsM: 200, toleranciaPromessaDias: 2,
      inicioRota: '08:00', minutosPorVisita: 15, velocidadeKmH: 25,
    },
    cobradores: [
      { id: 'cb1', nome: 'Carlos Moto', telefone: '(11) 90000-0001', veiculo: 'Honda CG 160', ativo: true, capacidade: 8, consentimentoEm: null },
      { id: 'cb2', nome: 'Marina Entregas', telefone: '(11) 90000-0002', veiculo: 'Yamaha Factor 150', ativo: true, capacidade: 8, consentimentoEm: null },
    ],
    regras: [
      { id: 'rg1', nome: '3 a 5 dias', diasMin: 3, diasMax: 5, ativa: true, prioridade: 1 },
      { id: 'rg2', nome: '6 a 10 dias', diasMin: 6, diasMax: 10, ativa: true, prioridade: 2 },
      { id: 'rg3', nome: '11 a 20 dias', diasMin: 11, diasMax: 20, ativa: true, prioridade: 3 },
      { id: 'rg4', nome: '21 a 60 dias', diasMin: 21, diasMax: 60, ativa: true, prioridade: 4 },
    ],
    motivos: MOTIVOS.map(([descricao, tipo], i) => ({ id: `mt${i + 1}`, descricao, tipo, ativo: true })),
    clientes: CLIENTES.map(([cod, nome, praca, endereco, lat, lng, telefone]) => ({ cod, nome, praca, endereco, lat, lng, telefone })),
    titulos,
    rotas: [], rotaCobradores: [], paradas: [], paradaTitulos: [],
    checkins: [], rastreamento: [], monitorados: [],
  };
}
