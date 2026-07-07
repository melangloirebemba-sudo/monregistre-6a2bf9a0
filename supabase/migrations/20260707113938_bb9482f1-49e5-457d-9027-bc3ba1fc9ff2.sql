
-- Trigger-only functions: revoke EXECUTE from public/anon/authenticated
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_admin_by_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_numero_recu() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_account_reactivated() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_account_deletion_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_plan_limits() FROM PUBLIC, anon, authenticated;

-- Admin-only maintenance: only service_role
REVOKE ALL ON FUNCTION public.expire_plans() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_plans() TO service_role;

-- activate_plan already checks admin role internally, but restrict to authenticated only (not anon)
REVOKE ALL ON FUNCTION public.activate_plan(uuid, app_plan, plan_periode) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_plan(uuid, app_plan, plan_periode) TO authenticated, service_role;

-- Utility functions used by RLS/RPC: keep available to authenticated, revoke from anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid) TO authenticated, service_role;

-- Immutable helper, safe but restrict anon
REVOKE ALL ON FUNCTION public.plan_periode_days(plan_periode) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_periode_days(plan_periode) TO authenticated, service_role;
