# Fahim Ahmed | Personal Website

A responsive, self-contained portfolio for `fahim152.com`. A Danish-inspired layout with warm paper, deep teal, terracotta, soft blue, and gold, with factual, team-oriented copy. Brief entrance animations, interactive diagram paths, and expandable career sections add motion without autoplay loops or hiding content. Plain HTML, CSS, and JavaScript. No build step or runtime dependencies.

## Preview

Open `public/index.html` directly in a browser. Navigation, career chapters, and the system explorer work locally. Core content and career chapters also work with JavaScript disabled.

## Publish With Cloudflare Pages

1. Sign in to Cloudflare and open **Workers & Pages**. Create a Pages project using **Direct Upload / Upload assets** (the wording may vary).
2. Upload **only the contents of `website/public`**. `index.html` must be at the root of the upload. Never upload the original job-application directory, resume, or cover letter.
3. Deploy and check the generated `pages.dev` address on desktop and mobile.
4. In the Pages project, open **Custom domains**, choose **Set up a custom domain**, and enter `fahim152.com`.
5. For an apex domain such as `fahim152.com`, Cloudflare Pages requires the domain to be a zone in the same Cloudflare account. If it is not already there, add the domain and follow the nameserver instructions at your domain registrar. Review and preserve existing DNS records, particularly email MX/TXT records, before changing nameservers.
6. Let Pages create the required DNS record and provision HTTPS. Wait until the domain and certificate are active, then verify `https://fahim152.com`.
7. If you also want `www.fahim152.com`, add it separately and configure a redirect to the canonical apex domain. The site itself uses `https://fahim152.com/` as its canonical URL.

The included `_headers` file is supported by Cloudflare Pages and Netlify. It applies the security headers when hosted there. Check the live response headers after deployment. Other static hosts can serve the site too, but you must configure equivalent headers yourself. GitHub Pages does not apply `_headers`.

Deployment requires your hosting and domain accounts; this project has not been published or connected to your domain automatically.

## Editing

- `public/index.html`: profile, career, education, research, and LinkedIn links.
- `public/styles.css`: layout, palette, responsive styles, and reduced-motion support.
- `public/script.js`: system-diagram interactions and active navigation.
- `public/favicon.svg`: browser-tab monogram.
- `public/_headers`: hosting security headers.

Dates and professional details come from the supplied resume and cover letter. LinkedIn blocked automated access and was not used as a content source. The current LEGO role is presented as a fixed-term paternity-cover position. Review the current role after its scheduled January 2027 end date. No unpublished research is described as published, and the diagram is a conceptual illustration of technical subjects, not an employer architecture diagram. Employers are identified by their names and work cities/countries, without invented logos. Monstarlab shows Copenhagen in the role header; its project descriptions distinguish pharmaceutical work from 2024 and earlier remote HR/project-management work from Dhaka until 2023.

## Privacy

- No phone number, home or street address, email address, private document downloads, or embedded personal-document metadata. Employer cities and countries are included as professional context, not residential information.
- No analytics, cookies, browser storage, forms, third-party scripts, external fonts, or embedded LinkedIn content.
- All assets are served locally. LinkedIn loads only when a visitor chooses to follow a link.
- External links use `noopener noreferrer`, and the site sends no referrer.
- A restrictive Content Security Policy is included in both HTML and hosting headers. Framing protection requires the hosting headers; it cannot be enforced from an HTML meta tag.
- Hosting providers may still retain request logs and visitor IP addresses under their own policies. LinkedIn has its own privacy practices once a visitor leaves this site.
- HTTPS and account security still matter: enable multi-factor authentication on your registrar and hosting accounts, restrict account access, and do not place secrets in public files.

## Verification

Run `node check.mjs` from this directory. It uses Node.js 22 or newer and a locally installed Google Chrome (or `CHROME_PATH`) without additional packages. It checks content and privacy invariants, project-specific locations, local asset requests, JavaScript errors, diagram controls, native career expansion, keyboard access, entrance and interactive animations, live changes to reduced-motion preferences, no-JavaScript rendering, and viewport overflow. It saves desktop and mobile screenshots in a temporary directory and prints the location.

Before publishing, read every professional claim, open every career chapter, and verify the actual live response headers and domain configuration. No resume is offered as a download intentionally; the original contains private contact information.
