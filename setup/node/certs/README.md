# Supabase public database CA

`supabase-prod-ca-2021.crt` is the public certificate downloaded over HTTPS from
the URL used by Supabase's own dashboard configuration:

https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

Production download:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Subject: `Supabase Root 2021 CA`, Supabase Inc. Expires 26 April 2031.
SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

This is public configuration, not a customer record or secret. It is used only
for hosted Supabase database hosts. The PostgreSQL adapter retains certificate
chain and hostname validation. `DATABASE_SSL_CA` can select a replacement CA file
when Supabase rotates its CA or when using another trusted database endpoint.
