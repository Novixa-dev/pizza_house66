# Publishing the Novixa organization profile

`README.md` in this folder is the organization profile for
<https://github.com/Novixa-dev> — the panel GitHub shows at the top of the
org page.

## Why it is a file and not a commit

GitHub renders an organization profile from a **special repository named
`.github`**, at the path `profile/README.md`. That repository is separate
from this one, and this session's GitHub access is scoped to
`novixa-dev/pizza_house66` only — a repository whose name begins with `.`
also cannot be attached here. So it is delivered as a file for you to publish
in two minutes.

## Steps

1. Go to <https://github.com/organizations/Novixa-dev/repositories/new>
2. Name it exactly **`.github`** — the leading dot matters. Make it
   **public**; a private `.github` repository renders nothing.
3. Create it with a README so the repo is not empty.
4. In that repository, create a folder `profile/` and a file inside it named
   `README.md`.
5. Paste the contents of this folder's `README.md` into it and commit.
6. Open <https://github.com/Novixa-dev>. The profile appears immediately.

Via the command line instead:

```bash
git clone https://github.com/Novixa-dev/.github.git
cd .github
mkdir -p profile
cp /path/to/this/README.md profile/README.md
git add profile/README.md
git commit -m "Add organization profile"
git push
```

## Before you publish — fill these in

The draft deliberately contains **no invented facts**. Add the real ones:

- [ ] **Contact.** The "Get in touch" section has no email, phone or site,
      because I do not have them. Add whatever you want people to use.
- [ ] **Location**, if you want it public.
- [ ] **Founded / team size**, if relevant.
- [ ] **Other projects.** Only Pizza House is listed, since it is the only
      one I have seen. Add the rest in the same shape: what problem it
      solved, then the stack — in that order.
- [ ] **A logo**, if you have one. Put the image in the `.github` repository
      and reference it at the top; keep it under ~200px wide so it does not
      dominate the page.

## While you are in the organization settings

Four things that do more for how the org reads than the README does:

- **Set the organization's display name, avatar, and one-line description.**
  The description shows in search results; the README does not.
- **Pin `pizza_house66`** to the organization page, and give it a description
  and topics (`nextjs`, `typescript`, `restaurant`, `arabic`, `rtl`,
  `postgresql`). Topics are how GitHub search finds a repository.
- **Add a description and website** to each repository. An untitled
  repository looks abandoned even when it is not.
- **Decide on visibility.** A public `pizza_house66` shows the work — and
  makes Vercel's Hobby plan able to deploy it, which a private org-owned
  repository cannot (`docs/DEPLOYMENT.md`). If it stays private, the profile
  README is the only thing a visitor sees, which is an argument for making it
  good.

## A note on the two-language layout

The Arabic half is wrapped in `<div dir="rtl">`. GitHub's Markdown renderer
honours that attribute, so the Arabic renders right-to-left and the English
below it left-to-right, on one page, without either fighting the other.

Keep the `<div dir="rtl">` wrapper if you edit the Arabic. Without it, GitHub
renders Arabic left-to-right and the punctuation lands on the wrong side of
every line.
