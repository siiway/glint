# Share Links

Share links let you expose a single todo set to people **outside your team** — clients, collaborators, or the public — without giving them a Prism account or team membership. Each link is a unguessable URL with its own set of capabilities, so you can publish a read-only roadmap or open up a collaborative checklist as needed.

Share links also generate **embeddable SVG images** (a progress badge and a rendered checklist) that you can drop into a README, wiki, or dashboard.

---

## Creating a Share Link

1. Open the set you want to share.
2. Open **Manage Links** (from the set's `...` menu).
3. Click **New link**, give it a name, and choose its capabilities.
4. Copy the generated URL and share it.

Creating, editing, and deleting links requires the `manage_set_links` permission (granted to owners, co-owners, and admins by default).

---

## Capabilities

Each link grants a precise set of capabilities. By default a new link is **view-only**.

| Capability | What it allows |
| --- | --- |
| **View** | Read the set and its todos (default `on`). |
| **Create** | Add new todos and sub-todos. |
| **Edit** | Change todo titles. |
| **Complete** | Toggle todo completion. |
| **Delete** | Delete todos. |
| **Comment** | Reserved for future public commenting. |
| **Reorder** | Drag to reorder todos. |

Visitors only see and can perform the actions the link allows; everything else is blocked server-side.

::: warning
Anyone who has the link URL can use it within its granted capabilities. Treat write-enabled links like a password and delete them when no longer needed — deleting a link instantly revokes access.
:::

---

## Restricting by Email

A link can be limited to specific people with a comma-separated **email allow-list**. When set:

- Visitors are prompted to enter their email before the set loads.
- Only emails on the list are granted access; everyone else is denied.

Leave the allow-list empty for a fully public link.

::: info
The email check is a lightweight gate, not authenticated identity verification — there is no email confirmation step. Use it to keep casual links private, not to protect highly sensitive data.
:::

---

## Embeddable Badges & Checklists

Every link can render two cached, read-only SVG images. These ignore capability flags and email restrictions, so they always render for anyone with the token.

### Progress badge

A shields.io-style badge showing completed/total:

```markdown
![todos](https://glint.example.com/api/shared/<token>/badge.svg)
```

Customize it with query parameters such as `style=flat-square`, `label=Roadmap`, or `color=blue`.

### Checklist image

A full rendered checklist of the set:

```markdown
![checklist](https://glint.example.com/api/shared/<token>/todo-list.svg?theme=dark)
```

Useful options: `theme=dark`, `maxItems=10`, `width=480`, `showProgress=false`, plus color overrides. See the [Share Links API](../api/shares#embeddable-svgs) for the full parameter list.

---

## Managing Links

From **Manage Links** you can:

- See every link for the set, including its capabilities and creation date.
- Edit a link's name, capabilities, or email allow-list at any time.
- Delete a link to immediately revoke it.

A team-wide view lists all links across every set (annotated with the set name) for auditing.

---

## API Reference

See the [Share Links API](../api/shares) for the full endpoint reference, request/response shapes, and error codes.
