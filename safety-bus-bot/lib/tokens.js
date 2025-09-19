// lib/tokens.js
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './db.js';

async function issueLinkToken({ parent_id, issued_by }) {
  const token = uuidv4();
  const { error } = await supabase.from('parent_link_tokens')
    .insert({ token, parent_id, issued_by });
  if (error) throw error;
  return token;
}

async function consumeLinkToken(token) {
  const { data, error } = await supabase
    .from('parent_link_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('TOKEN_NOT_FOUND');
  if (data.used_at) throw new Error('TOKEN_USED');
  if (new Date(data.expires_at) < new Date()) throw new Error('TOKEN_EXPIRED');
  return data;
}

async function markTokenUsed(token, line_user_id) {
  const { error } = await supabase
    .from('parent_link_tokens')
    .update({ used_at: new Date().toISOString(), used_by_line_user_id: line_user_id })
    .eq('token', token);
  if (error) throw error;
}

export { issueLinkToken as issueToken, consumeLinkToken as consumeToken, markTokenUsed };
