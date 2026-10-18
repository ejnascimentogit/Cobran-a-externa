import { useState } from 'react';
import { supabase } from '../../../compartilhado/real/cliente.js';
import { useCarga, ler } from '../../../compartilhado/real/hooks.js';
import { mensagemDeErro } from '../../../compartilhado/real/resumo.js';

const VAZIA = { cob02_nome: '', cob02_dias_min: '', cob02_dias_max: '', cob02_prioridade: '' };

export default function Regras({ empresaId }) {
  const { dados, erro, recarregar } = useCarga(() => ler(supabase.from('cob02_regra').select('*').order('cob02_prioridade').order('cob02_id')));
  const [form, setForm] = useState(VAZIA);
  const [msg, setMsg] = useState('');
  const campo = k => ({ value: form[k] ?? '', onChange: e => setForm({ ...form, [k]: e.target.value }) });

  const salvar = async () => {
    setMsg('');
    const linha = {
      cob02_nome: (form.cob02_nome || '').trim(),
      cob02_dias_min: Number(form.cob02_dias_min),
      cob02_dias_max: Number(form.cob02_dias_max),
      cob02_prioridade: Number(form.cob02_prioridade) || 99,
    };
    if (!linha.cob02_nome) return setMsg('Informe o nome da regra.');
    if (!Number.isInteger(linha.cob02_dias_min) || !Number.isInteger(linha.cob02_dias_max) || form.cob02_dias_min === '' || form.cob02_dias_max === '') {
      return setMsg('Informe os dias mínimo e máximo.');
    }
    const { error } = form.cob02_id
      ? await supabase.from('cob02_regra').update(linha).eq('cob02_id', form.cob02_id)
      : await supabase.from('cob02_regra').insert({ ...linha, cob02_empresa_id: empresaId });
    if (error) return setMsg(mensagemDeErro(error));
    setForm(VAZIA);
    recarregar();
  };

  const alternar = async r => {
    setMsg('');
    const { error } = await supabase.from('cob02_regra').update({ cob02_ativo: !r.cob02_ativo }).eq('cob02_id', r.cob02_id);
    if (error) setMsg(mensagemDeErro(error));
    recarregar();
  };

  return (
    <div className="grade duas-colunas">
      <div className="card">
        <h2>Regras por faixa de atraso</h2>
        <p className="suave">Cada regra gera a sua consulta. As faixas ativas não podem se sobrepor (o banco recusa).</p>
        {erro && <div className="erro">{erro}</div>}
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Regra</th><th className="num">De</th><th className="num">Até</th><th>Ativa</th><th /></tr></thead>
          <tbody>
            {(dados || []).map(r => (
              <tr key={r.cob02_id} style={{ opacity: r.cob02_ativo ? 1 : .55 }}>
                <td>{r.cob02_nome}</td><td className="num">{r.cob02_dias_min} d</td><td className="num">{r.cob02_dias_max} d</td>
                <td><input type="checkbox" checked={r.cob02_ativo} onChange={() => alternar(r)} /></td>
                <td className="num"><button onClick={() => setForm({ ...r })}>Editar</button></td>
              </tr>
            ))}
            {dados && !dados.length && <tr><td colSpan="5" className="suave">Nenhuma regra ainda.</td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <h2>{form.cob02_id ? 'Editar regra' : 'Nova regra'}</h2>
        {msg && <div className="erro">{msg}</div>}
        <label>Nome<input {...campo('cob02_nome')} placeholder="Ex.: 61 a 90 dias" /></label>
        <div className="grade" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <label>Dias mínimo<input type="number" min="0" {...campo('cob02_dias_min')} /></label>
          <label>Dias máximo<input type="number" min="0" {...campo('cob02_dias_max')} /></label>
          <label>Prioridade<input type="number" min="1" {...campo('cob02_prioridade')} /></label>
        </div>
        <div className="linha-acoes">
          <button className="principal" onClick={salvar}>{form.cob02_id ? 'Salvar' : 'Adicionar regra'}</button>
          {form.cob02_id && <button onClick={() => { setForm(VAZIA); setMsg(''); }}>Cancelar</button>}
        </div>
      </div>
    </div>
  );
}
