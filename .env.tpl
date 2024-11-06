# These variables are only available in your SST code.

# uncomment to try out deploying the w3up api under a custom domain (or more
# than one). the value should match a hosted zone configured in route53 that
# your aws account has access to.
# HOSTED_ZONES=upload.storacha.network

# uncomment to try out deploying the roundabout api under a custom domain.
# the value should match a hosted zone configured in route53 that your aws account has access to.
# ROUNDABOUT_HOSTED_ZONE=roundabout.storacha.network

# uncomment to set SENTRY_DSN
# SENTRY_DSN = ''

PROVIDERS = ''
UPLOAD_API_DID = ''
ACCESS_SERVICE_URL = ''
AGGREGATOR_DID = ''
AGGREGATOR_URL = ''
DEAL_TRACKER_DID = ''
DEAL_TRACKER_URL = ''

POSTMARK_TOKEN = ''
R2_ACCESS_KEY_ID = ''
R2_CARPARK_BUCKET_NAME = ''
R2_ENDPOINT = ''
R2_REGION = ''
R2_SECRET_ACCESS_KEY = ''
R2_DELEGATION_BUCKET_NAME = ''

# Following variables are only required to run integration tests

# Mailslurp
MAILSLURP_API_KEY = ''
MAILSLURP_TIMEOUT = '120000'

# Stripe
# these values are from the Stripe test environment
STRIPE_PRICING_TABLE_ID = 'prctbl_1NzhdvF6A5ufQX5vKNZuRhie'
STRIPE_PUBLISHABLE_KEY = 'pk_test_51LO87hF6A5ufQX5viNsPTbuErzfavdrEFoBuaJJPfoIhzQXdOUdefwL70YewaXA32ZrSRbK4U4fqebC7SVtyeNcz00qmgNgueC'
# this is used in tests and should always be set to the test env secret key
STRIPE_TEST_SECRET_KEY = ''

# Feature flags
REQUIRE_PAYMENT_PLAN = 'true'
