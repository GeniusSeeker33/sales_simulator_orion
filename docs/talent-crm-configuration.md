# Talent CRM configuration diagnostics

The reported progression was TLS `SELF_SIGNED_CERT_IN_CHAIN`, then PostgreSQL
`28P01` after adding a CA, then `crm_configuration_invalid` after replacing the
database URI. The leading explanation for the latest failure is URI formatting
or driver initialization, not a proven renewed TLS failure. The old diagnostic
cannot identify which check failed. No secret values are needed to distinguish
these checks with the new diagnostics.

## Every PR #40 configuration-invalid path

`validateCrmUrl` rejected a URL parse exception, unsupported protocol, missing
hostname, username, password or database path, a nonempty fragment, surrounding
whitespace, or a username/password that `decodeURIComponent` could not decode.
Missing/empty URL instead produced `crm_not_configured`. A synchronous pool
constructor exception also produced `crm_configuration_invalid`, unless its code
was allowlisted as a connection failure. For example, postgres 3.4.8 rejects an
unsupported `target_session_attrs` option during construction. This option can
also come from the driver's environment defaults.

PR #40 did **not** validate PEM content. The driver stores the SSL options and
uses them later in `tls.connect`. Consequently, escaped newlines could make the
CA unusable at connection time, but did not themselves trigger the old URL
validator. Reaching `28P01` is evidence that the preceding TLS attempt advanced
to database authentication; it does not establish the current deployment's
certificate configuration.

## New safe diagnostics

All remain HTTP 503 with the same generic browser response. Logs contain only
allowlisted category, stage, optional code, and these field/reason pairs:

| Field | Reasons |
| --- | --- |
| `CRM_DATABASE_URL` | `invalid_url`, `unsupported_protocol`, `missing_hostname`, `missing_username`, `missing_password`, `missing_database`, `unexpected_fragment`, `surrounding_whitespace`, `invalid_username_encoding`, `invalid_password_encoding` |
| `CRM_DATABASE_CA_CERT` | `invalid_pem`, `malformed_certificate` |
| `CRM_DATABASE_POOL` | `initialization_failed` |

Checks report the first failure. WHATWG parsing can reject a malformed authority
or port before individual field checks, yielding `invalid_url`. Pool initialization
uses a separate field because an unexpected constructor failure cannot safely be
attributed to one environment variable. No exception message or stack is logged.
Field/reason pairs are revalidated at the logging boundary. No variable values,
hostnames, usernames, passwords, URLs, query parameters, certificate bodies,
tokens, or candidate data are recorded.

## URI encoding

A valid percent-encoded UTF-8 password passes unchanged. Validation decodes only
to check syntax; postgres decodes the original credential once. Escaped reserved
characters, literal percent signs encoded as `%25`, and Unicode are supported.
Malformed escapes such as `%ZZ`, truncated escapes, and invalid UTF-8 such as
`%FF` fail credential decoding even when WHATWG URL construction succeeds.
These are also incompatible with the installed driver's `decodeURIComponent`.
Double encoding can pass but authenticate with a different password. A placeholder
can also pass syntax checks. Neither case can be detected without authentication.
Whitespace, surrounding quotes, and unencoded URI delimiters can independently
invalidate or change the parsed URI. The fix does not rewrite credentials.

## Certificates and Vercel multiline values

[Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
are exposed to Node through `process.env`. Storage as a sensitive value does not
make a literal backslash followed by `n` equivalent to a newline in our code.
File loaders and shell quoting can affect the representation; do not infer the
runtime representation from how a settings screen displays it. No hosted value
was retrieved or inspected for this change.

The parser now accepts literal LF/CRLF and escaped `\n`/`\r\n`, trims outer
whitespace, and validates every PEM certificate in a bundle using Node's
[X509Certificate](https://nodejs.org/api/crypto.html#class-x509certificate).
Missing/empty optional CA retains default trust. A supplied whitespace-only,
quoted, non-PEM, or mixed-content value fails `invalid_pem`; structurally framed
PEM that cannot be parsed as X.509 fails `malformed_certificate`. Certificate
parsing is not a substitute for chain, hostname, or expiration verification:
`rejectUnauthorized: true` remains enforced at connection time. No fallback to
insecure TLS or privileged database access is introduced.

No migration, hosted-data change, deployment, or credential change is required
to review this code. Determining the exact hosted failure still requires a future
invocation of the updated diagnostic, under the operator's deployment process.
