# Agentsol website (published files only)

Static files for the Agentsol website, served by GitHub Pages. They are generated from a separate private source repository; nothing here is the product source.

- Package: https://www.npmjs.com/package/agentsol (early alpha, MIT)
- The demo on this site uses a made-up project recorded at build time. There are no forms, analytics, cookies or third-party scripts, and the site makes no network requests of its own.
- GitHub Pages cannot send custom security headers, so the Content-Security-Policy is a <meta> tag. That cannot prevent other sites from framing the page (frame-ancestors).
