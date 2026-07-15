-- Revoke EXECUTE from PUBLIC on rls_auto_enable event trigger function.
-- The initial migration only revoked from anon/authenticated, but the ACL
-- had a grant to PUBLIC (=) which still allowed execution. This closes that gap.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
