// Cria o login do motoqueiro e o cadastro em cob01_cobrador. Com { acao: "redefinir_senha", cobrador_id } gera a senha provisória de novo.
// ATENÇÃO: no Supabase (EFR_ecommerce_tirapedidos) esta função foi publicada com o nome `clever-endpoint`
// (o editor do painel dá um nome aleatório e o nome publicado não muda). Endereço:
// https://xaicysbwwppqdhktchzy.supabase.co/functions/v1/clever-endpoint
// Só o administrador da empresa (tb02_papel = 'empresa_admin') pode chamar.
// O login do motoqueiro NÃO leva empresa_id no app_metadata (decisão do docs/11): sem isso ele
// não alcança nenhuma tabela do e-commerce; o vínculo com a empresa fica em cob01_cobrador.
// A empresa vem SEMPRE do token de quem chama, nunca do corpo da requisição.
// Segredos usados (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY) já existem nas Edge Functions.
// Responde sempre 200 com { ok, erro } para a tela mostrar a mensagem.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), { headers: { ...CORS, "Content-Type": "application/json" } });

// Decisão do Edimilson (2026-10-19): a senha provisória é sempre esta. O login nasce com
// trocar_senha = true e o app obriga a escolher a senha própria (mínimo 8 caracteres e diferente da provisória) no primeiro acesso.
const SENHA_PROVISORIA = "12345678";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(token);
    if (erroSessao || !sessao.user) return json({ ok: false, erro: "Sessão inválida. Entre de novo." });

    const empresaId = Number(sessao.user.app_metadata?.empresa_id);
    if (!Number.isInteger(empresaId)) {
      return json({ ok: false, erro: "Seu usuário não está ligado a uma empresa." });
    }
    const { data: adm } = await admin
      .from("tb02_usuario").select("tb02_id")
      .eq("tb02_auth_id", sessao.user.id).eq("tb02_empresa_id", empresaId)
      .eq("tb02_papel", "empresa_admin").eq("tb02_ativo", true)
      .maybeSingle();
    if (!adm) return json({ ok: false, erro: "Só o administrador da empresa cria motoqueiros." });

    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "redefinir_senha") {
      // Gerar nova senha: volta para a provisória e obriga a troca no próximo acesso.
      const { data: cob } = await admin
        .from("cob01_cobrador").select("cob01_auth_id, cob01_nome")
        .eq("cob01_id", Number(corpo.cobrador_id)).eq("cob01_empresa_id", empresaId) // só motoqueiro da própria empresa
        .maybeSingle();
      if (!cob?.cob01_auth_id) return json({ ok: false, erro: "Motoqueiro não encontrado." });
      const { error: erroSenha } = await admin.auth.admin.updateUserById(cob.cob01_auth_id, {
        password: SENHA_PROVISORIA,
        user_metadata: { nome: cob.cob01_nome, trocar_senha: true },
      });
      if (erroSenha) return json({ ok: false, erro: "Não consegui gerar a nova senha." });
      return json({ ok: true, cobrador: { cob01_nome: cob.cob01_nome }, senha_provisoria: SENHA_PROVISORIA });
    }
    const nome = texto(corpo.nome, 120);
    const email = texto(corpo.email, 160).toLowerCase();
    const telefone = texto(corpo.telefone, 40) || null;
    const veiculo = texto(corpo.veiculo, 60) || null;
    const capacidade = corpo.capacidade === undefined ? 8 : Number(corpo.capacidade);
    if (!nome) return json({ ok: false, erro: "Informe o nome." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, erro: "E-mail inválido." });
    if (!Number.isInteger(capacidade) || capacidade < 1) {
      return json({ ok: false, erro: "A capacidade precisa ser um número inteiro maior que zero." });
    }

    const senha = SENHA_PROVISORIA;
    const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      app_metadata: { papel: "cobrador" }, // sem empresa_id, de propósito
      user_metadata: { nome, trocar_senha: true },
    });
    if (erroAuth || !criado.user) {
      const jaExiste = /already|registered|exists/i.test(erroAuth?.message ?? "");
      return json({ ok: false, erro: jaExiste ? "Este e-mail já tem login." : "Não consegui criar o login." });
    }

    const { data: cobrador, error: erroCob } = await admin
      .from("cob01_cobrador")
      .insert({
        cob01_empresa_id: empresaId, cob01_auth_id: criado.user.id, cob01_nome: nome,
        cob01_email: email, cob01_telefone: telefone, cob01_veiculo: veiculo, cob01_capacidade: capacidade,
      })
      .select("cob01_id, cob01_nome, cob01_email")
      .single();
    if (erroCob || !cobrador) {
      await admin.auth.admin.deleteUser(criado.user.id); // desfaz o login se o cadastro falhou
      const duplicado = erroCob?.code === "23505";
      return json({ ok: false, erro: duplicado ? "Já existe um motoqueiro com este e-mail." : "Não consegui salvar o cadastro." });
    }

    // A senha provisória aparece só aqui, uma vez. O app pede a troca no primeiro acesso (trocar_senha).
    return json({ ok: true, cobrador, senha_provisoria: senha });
  } catch {
    return json({ ok: false, erro: "Erro inesperado." });
  }
});
