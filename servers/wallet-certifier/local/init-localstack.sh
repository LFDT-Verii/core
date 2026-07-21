#!/bin/sh
set -eu

endpoint="http://localstack:4566"
awslocal --endpoint-url "$endpoint" ses verify-email-identity --email-address certifier@velocitynetwork.foundation
awslocal --endpoint-url "$endpoint" ses verify-email-identity --email-address support@velocitynetwork.foundation
awslocal --endpoint-url "$endpoint" ses verify-email-identity --email-address alex@example.com
