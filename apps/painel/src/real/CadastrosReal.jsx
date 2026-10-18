import { useState } from 'react';
import { supabase } from '../../../compartilhado/real/cliente.js';
import { FUNCAO_CRIAR_COBRADOR } from '../../../compartilhado/real/config.js';
import { useCarga, ler } from '../../../compartilhado/real/hooks.js';
import { mensagemDeErro } from '../../../compartilhado/real/resumo.js';
import { horaBR, dataBR } from '../../../compartilhado/formato.js';

const TIPOS = { pago: 'Pagou', promessa: 'Promessa', negociado: 'Negociado', sem_sucesso: 'Sem sucesso' };

function Motoqueiros() {
  const { dados, erro, recarregar } = useCarga(() => ler(supabase.from('cob01_cobrador').select('*').order('cob01_nome')));
  const [f, setF] = useState({ nome: '', email: '', telefone: '', veiculo: '', capacidade: 8 });
  const [msg, setMsg] = useState('');
  const [nova, setNova] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const criar = async () => {
    setMsg('');
    setNova(null);
    setOcupado(true);
    const { data, error } = await supabase.functions.invoke(FUNCAO_CRIAR_COBRADOR, { body: f });
    setOcupado(false);
    if (error) return setMsg('Não consegui chamar a função que cria o motoqueiro. Confira se ela está publicada.');
    if (!data?.ok) return setMsg(data?.erro || 'Não consegui criar.');
    setNova({ nome: data.cobrador.cob01_nome, email: data.cobrador.cob01_email, senha: data.senha_provisoria });
    setF({ nome: '', email: '', telefone: '', veiculo: '', capacidade: 8 });
    recarregar();
  };
  const alternar = async c => {
    const { error } = await supabase.from('cob01_cobrador').update({ cob01_ativo: !c.cob01_ativo }).eq('cob01_id', c.cob01_id);
    if (error) setMsg(mensagemDeErro(error));
    recarregar();
  };
  const campo = k => ({ value: f[k], onChange: e => setF({ ...f, [k]: e.target.value }) });

  return (
    <div className="card">
      <h2>Motoqueiros</h2>
      {(erro || msg) && <div className="erro">{msg || erro}</div>}
      {nova && (
        <div className="ok">
          <b>Login criado para {nova.nome}.</b> Entregue estes dados a ele. A senha provisória <b>aparece só agora</b>; no primeiro acesso ele escolhe a própria.
          <div style={{ marginTop: '.4rem' }}>E-mail: <code>{nova.email}</code><br />Senha provisória: <code>{nova.senha}</code></div>
        </div>
      )}
      <div className="tabela-rolagem"><table>
        <thead><tr><th>Nome</th><th>Veículo</th><th className="num">Visitas/dia</th><th>Localização</th><th>Ativo</th></tr></thead>
        <tbody>
          {(dados || []).map(c => (
            <tr key={c.cob01_id}>
              <td>{c.cob01_nome}<div className="suave">{c.cob01_email}</div></td><td>{c.cob01_veiculo || '—'}</td>
              <td className="num">{c.cob01_capacidade}</td>
              <td className="suave">{c.cob01_consentimento_em ? `Aceitou em ${dataBR(c.cob01_consentimento_em.slice(0, 10))} ${horaBR(c.cob01_consentimento_em)}` : 'Ainda não aceitou'}</td>
              <td><input type="checkbox" checked={c.cob01_ativo} onChange={() => alternar(c)} /></td>
            </tr>
          ))}
          {dados && !dados.length && <tr><td colSpan="5" className="suave">Nenhum motoqueiro.</td></tr>}
        </tbody>
      </table></div>
      <h3 style={{ marginTop: '1rem' }}>Novo motoqueiro</h3>
      <p className="suave">Só o administrador da empresa consegue criar. O login nasce sem acesso aos dados do e-commerce.</p>
      <div className="grade" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label>Nome<input {...campo('nome')} /></label>
        <label>E-mail<input type="email" {...campo('email')} /></label>
        <label>Telefone<input {...campo('telefone')} /></label>
        <label>Veículo<input {...campo('veiculo')} /></label>
        <label>Visitas por dia<input type="number" min="1" {...campo('capacidade')} /></label>
      </div>
      <button className="principal" disabled={ocupado} onClick={criar}>{ocupado ? 'Criando…' : 'Criar motoqueiro'}</button>
    </div>
  );
}

function Motivos({ empresaId }) {
  const { dados, erro, recarregar } = useCarga(() => ler(supabase.from('cob03_motivo').select('*').order('cob03_id')));
  const [m, setM] = useState({ nome: '', tipo: 'sem_sucesso' });
  const [msg, setMsg] = useState('');
  const adicionar = async () => {
    setMsg('');
    if (!m.nome.trim()) return;
    const { error } = await supabase.from('cob03_motivo').insert({ cob03_empresa_id: empresaId, cob03_nome: m.nome.trim(), cob03_tipo: m.tipo });
    if (error) return setMsg(mensagemDeErro(error));
    setM({ nome: '', tipo: 'sem_sucesso' });
    recarregar();
  };
  const alternar = async x => {
    const { error } = await supabase.from('cob03_motivo').update({ cob03_ativo: !x.cob03_ativo }).eq('cob03_id', x.cob03_id);
    if (error) setMsg(mensagemDeErro(error));
    recarregar();
  };
  return (
    <div className="card">
      <h2>Motivos do check-in</h2>
      {(erro || msg) && <div className="erro">{msg || erro}</div>}
      <div className="tabela-rolagem"><table>
        <thead><tr><th>Motivo</th><th>Tipo</th><th>Ativo</th></tr></thead>
        <tbody>
          {(dados || []).map(x => (
            <tr key={x.cob03_id}><td>{x.cob03_nome}</td><td>{TIPOS[x.cob03_tipo]}</td>
              <td><input type="checkbox" checked={x.cob03_ativo} onChange={() => alternar(x)} /></td></tr>
          ))}
        </tbody>
      </table></div>
      <div className="linha-acoes" style={{ marginTop: '.75rem' }}>
        <input style={{ flex: 1, minWidth: 160 }} placeholder="Novo motivo" value={m.nome} onChange={e => setM({ ...m, nome: e.target.value })} />
        <select style={{ width: 150 }} value={m.tipo} onChange={e => setM({ ...m, tipo: e.target.value })}>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="principal" onClick={adicionar}>Adicionar</button>
      </div>
    </div>
  );
}

const CAMPOS_CONFIG = [
  ['cob11_raio_gps_m', 'Raio de GPS aceito no check-in (metros)', 'number'],
  ['cob11_tolerancia_promessa_dias', 'Tolerância da promessa (dias após a data prometida)', 'number'],
  ['cob11_prazo_sincronizacao_horas', 'Prazo para o app sincronizar sem ficar suspeito (horas)', 'number'],
  ['cob11_tolerancia_relogio_min', 'Tolerância do relógio do aparelho (minutos)', 'number'],
  ['cob11_minutos_por_visita', 'Minutos por visita (previsão de chegada)', 'number'],
  ['cob11_velocidade_km_h', 'Velocidade média (km/h)', 'number'],
  ['cob11_deposito_nome', 'Nome do ponto de saída e retorno', 'text'],
  ['cob11_deposito_latitude', 'Latitude do ponto de saída', 'number'],
  ['cob11_deposito_longitude', 'Longitude do ponto de saída', 'number'],
];

function Parametros({ empresaId }) {
  const { dados, erro, recarregar } = useCarga(() => ler(supabase.from('cob11_config').select('*').eq('cob11_empresa_id', empresaId).maybeSingle()));
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState('');
  const valores = edit ?? dados ?? {};
  const salvar = async () => {
    setMsg('');
    const linha = {};
    for (const [k, , tipo] of CAMPOS_CONFIG) {
      const v = valores[k];
      linha[k] = tipo === 'number' ? (v === '' || v == null ? null : Number(v)) : (v || null);
    }
    for (const k of ['cob11_raio_gps_m', 'cob11_tolerancia_promessa_dias', 'cob11_prazo_sincronizacao_horas', 'cob11_tolerancia_relogio_min', 'cob11_minutos_por_visita', 'cob11_velocidade_km_h']) {
      if (linha[k] === null) return setMsg('Preencha todos os números (só o ponto de saída pode ficar vazio).');
    }
    const { error } = await supabase.from('cob11_config').update(linha).eq('cob11_empresa_id', empresaId);
    if (error) return setMsg(mensagemDeErro(error));
    setEdit(null);
    setMsg('Salvo.');
    recarregar();
  };
  return (
    <div className="card">
      <h2>Parâmetros</h2>
      {erro && <div className="erro">{erro}</div>}
      {msg && <div className={msg === 'Salvo.' ? 'ok' : 'erro'}>{msg}</div>}
      {dados === null ? null : !dados?.cob11_id ? <div className="aviso">A empresa ainda não tem a linha de parâmetros (<code>cob11_config</code>).</div> : (
        <>
          {CAMPOS_CONFIG.map(([k, rotulo, tipo]) => (
            <label key={k}>{rotulo}
              <input type={tipo} step={tipo === 'number' ? 'any' : undefined} value={valores[k] ?? ''} onChange={e => setEdit({ ...valores, [k]: e.target.value })} />
            </label>
          ))}
          <button className="principal" disabled={!edit} onClick={salvar}>Salvar parâmetros</button>
        </>
      )}
    </div>
  );
}

export default function Cadastros({ empresaId }) {
  return (
    <div className="grade duas-colunas">
      <Motoqueiros />
      <div><Motivos empresaId={empresaId} /><Parametros empresaId={empresaId} /></div>
    </div>
  );
}
