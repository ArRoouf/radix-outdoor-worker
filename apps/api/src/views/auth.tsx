/** The body is composed by server form renderers; all variable values are escaped. */
export function authPage(title:string,body:string) {
  return '<!doctype html>'+(
    <html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{title} · Radix Outdoor</title><link rel="stylesheet" href="/styles.css"/><link rel="stylesheet" href="/utilities.css"/></head>
      <body class="store-body"><main class="auth-card"><a class="brand" href="/">Radix Outdoor</a><h1>{title}</h1><div dangerouslySetInnerHTML={{__html:body}}/></main></body>
    </html>
  ).toString();
}
