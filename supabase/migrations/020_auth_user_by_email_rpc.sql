-- RPC для поиска auth user по email (вместо listUsers() который возвращает только 50)
CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
