SELECT count(*),
             has_table_privilege('zeepcentraal_graphql','zc_private.global_metrics_snapshot','SELECT')
             FROM zc_private.global_metrics_snapshot
