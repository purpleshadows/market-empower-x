---
title: Cookie Policy
description: This Cookie Policy explains what cookies are, which cookies may be used on the Empower-X website and how you can manage them.
showLastUpdated: true
---

This policy explains what cookies are, which cookies may be used on the Empower-X website and how you can manage them. It should be read alongside our Privacy Policy.

## 1. What Are Cookies?

Cookies are small files downloaded to a user's device when they visit a website. They are used to remember browsing information, improve website functionality, measure website usage and, where applicable, personalise content.

In this policy, the term "cookies" also refers to web storage (`localStorage` and `sessionStorage`) and `IndexedDB`, which serve similar functions.

## 2. Types of Cookies We May Use

The Empower-X website may use the following categories of cookies:

- **Technical or strictly necessary cookies.** Required for the basic operation of the website, navigation, security or cookie-consent management. These cookies do not require consent.
- **Analytics cookies.** They help us understand how the website is used, which pages are visited and how we can improve the content and user experience. They will only be used where you have accepted them, except where applicable law permits the use of strictly limited measurement tools that are exempt from consent.
- **Third-party cookies.** These may be used when the website integrates external services such as videos, maps, social networks or other third-party tools. Those third parties may process data in accordance with their own privacy and cookie policies.

We do not use marketing cookies. Analytics (statistics) cookies are only set after you consent to them in the cookie notice.

## 3. Cookies Used on This Website

All cookies and web storage entries below are first-party: they are created by this website, for this website, and are never shared with advertisers. Settings cookies are only created when you actually change a default setting or use the related feature — simply visiting the site does not store them — and they are erased again when you return to the default.

### Settings (essential, stored as cookies)

| Name                        | Purpose                                                                                             | Duration                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `cookieConsentAcknowledged` | Remembers that you have seen and acknowledged the cookie notice, so it is not shown on every visit. | Created when you close the cookie notice. Stored for one year.                                                                |
| `AnalyticsCookieConsent`    | Remembers your choice about statistics cookies (accepted or declined).                              | Created when you make a choice in the cookie notice. Stored for one year.                                                     |
| `chainIds`                  | Stores the network(s) you have selected, allowing you to switch the data source of the interface.   | Created if you change the default network selection. Stored for one year, or erased immediately if you return to the default. |
| `bookmarks`                 | Stores your bookmarked assets.                                                                      | Created if you bookmark assets. Stored for one year, or erased immediately if you remove all your bookmarks.                  |
| `allowExternalContent`      | Stores whether the portal is allowed to load and display external content.                          | Created if you allow external content. Stored for 60 days, or erased immediately if you return to the default (do not allow). |
| `debug`                     | Stores whether debug mode is enabled, allowing you to use the debug feature.                        | Created if you activate debug mode. Stored for 60 days, or erased immediately if you deactivate it.                           |
| `onboardingModule`          | Stores whether the onboarding module is shown, so you can hide or re-enable the onboarding feature. | Created if you change the default setting. Stored for 60 days, or erased immediately if you return to the default.            |
| `onboardingStep`            | Stores your current step in the onboarding process, so you can continue where you left off.         | Created once you progress past the first step. Stored for 60 days, or erased immediately when you are back at step 0.         |
| `assetView`                 | Stores whether you prefer the grid or list view for asset lists.                                    | Created if you switch away from the default grid view. Stored for 60 days, or erased immediately if you switch back.          |

### Signing in and wallet connections (essential, web storage)

| Name                                                                                   | Purpose                                                                                                                        | Duration                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `oidc_session`, `auth_meta`, `token_expires_at`                                        | Keep you logged in to your account and remember when your login needs to be renewed.                                           | `localStorage`; removed when you log out or your login session ends.                                             |
| `sessionToken`                                                                         | Keeps you signed in to your SSI wallet so you do not have to unlock it again on every action.                                  | `localStorage`; stored until the token expires or you disconnect the wallet or log out.                          |
| `cachedCredentials`                                                                    | Caches your verifiable credentials so you do not have to present them again each time.                                         | `localStorage`; deleted when you disconnect the SSI wallet, log out, or your session expires.                    |
| `credentialSelectionStorage`                                                           | Remembers which of your credentials you selected during a credential check.                                                    | `localStorage`; deleted together with `cachedCredentials` on disconnect or logout.                               |
| `verifierSessionId`                                                                    | Stores verification session IDs after you pass a credential check, so you can download or start a job without verifying again. | `localStorage`; each entry is stored for at most one day, and everything is deleted on disconnect or logout.     |
| `credential_<assetId>_<serviceId>`                                                     | Stores the time of a successful credential check for an asset, to show you a "valid for X more minutes" countdown.             | `localStorage`; saved while you interact with an asset and removed when the check is reset or no longer valid.   |
| `wagmi.store`, `wagmi.recentConnectorId`                                               | Remember your wallet connection state (connected account, network) and the last wallet type you used, enabling auto-reconnect. | `localStorage`; kept while the wallet is connected so it can reconnect; cleared when you disconnect.             |
| `dfns_username`                                                                        | Remembers the username of your DFNS wallet so it can be reconnected.                                                           | `localStorage`; stored until you clear your browser storage.                                                     |
| `auth_callback_url`, `auth_mode`, `oidc_logout_pending`                                | Temporarily remember where to return to and which sign-in method you used while a login or logout is in progress.              | `sessionStorage`; removed after the sign-in or sign-out completes, at the latest when you close the browser tab. |
| `signer_server_connected`, `signer_server_selected_chain_id`, `dfns_selected_chain_id` | Temporarily remember which wallet service and network you connected through.                                                   | `sessionStorage`; deleted when you close the browser tab.                                                        |
| `ssiWalletApiOverride`                                                                 | Stores an SSI wallet API address you entered manually.                                                                         | `sessionStorage`; deleted when you close the browser tab.                                                        |

### Using compute features (essential, web storage)

| Name                              | Purpose                                                                                                    | Duration                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `compute-rerun:<jobId>`           | Passes a finished job's setup (algorithm and dataset IDs) along, to prefill the form when you rerun a job. | `localStorage`; stored only for a few seconds after selecting "rerun" for a compute job, then removed automatically.     |
| `computeOutputEncryption:<jobId>` | Stores the key needed to decrypt the results of your own compute job, so you can open them later.          | `localStorage`; stored until you clear your browser storage — without it, encrypted job results can no longer be opened. |

### Statistics (only with your consent)

If you consent to statistics cookies in the cookie notice, we use PostHog, a privacy-friendly product analytics service, to understand how the marketplace is used (for example, which pages are visited). This information is aggregated and anonymized and is used exclusively by us to improve the website.

| Name   | Purpose                                                                                          | Duration                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `ph_*` | PostHog cookies and web storage used to recognize returning visits and collect usage statistics. | Only set after you consent; removed again if you withdraw your consent in the cookie settings. Cookies last up to one year. |

If you do not consent, no statistics cookies or storage are created and nothing is sent to PostHog.

## 4. Managing Consent

When you access the website, you will be able to accept, reject or configure non-essential cookies. You may withdraw or change your consent at any time via the "Cookie Settings" link in the footer. The process for withdrawing consent is as easy as the process used to give it.

## 5. How to Delete or Block Cookies in Your Browser

You can also block or delete cookies through your browser settings. The steps may vary depending on the browser you use (for example Google Chrome, Mozilla Firefox, Safari or Microsoft Edge). Please note that blocking certain cookies — in particular the strictly necessary ones — may affect the proper operation of some parts of the website, such as wallet connections and asset access.

## 6. Cookies and Data from External Services

Where the website includes videos, embedded content or links to external platforms, those services may place their own cookies when you interact with them. Empower-X does not have full control over third-party cookies, and we recommend reviewing the privacy and cookie policies of the relevant services.

In addition, while not all are "cookies", the following services receive data during your use of the marketplace:

- **SSI Wallet API** — processes wallet addresses and credential IDs during verification.
- **Ocean Node** — receives DIDs and consumer addresses for asset downloads or compute jobs, and processes search and filter queries.
- **IPFS (Pinata / gateways)** — used for pinning and retrieving decentralised content.
- **PostHog (only with your consent)** — receives anonymised usage statistics.

## 7. Updates to the Cookie Policy

This policy may be updated when the cookies used, the website's technological tools or the applicable law change. The "Last updated" date at the top indicates the most recent changes.
