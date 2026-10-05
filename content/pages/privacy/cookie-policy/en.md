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

Currently, optional cookie categories (analytics/marketing) are not active in the user interface; the website relies on the strictly necessary first-party storage listed below.

## 3. Cookies Used on This Website

We use essential and preference-based first-party storage to ensure the portal functions correctly.

| Name / Key                  | Provider         | Purpose                                                             | Type and Duration                    |
| --------------------------- | ---------------- | ------------------------------------------------------------------- | ------------------------------------ |
| `wagmi.store`               | wagmi/connectkit | Stores wallet connection state (chain, connector, account mapping). | Cookie; session-based.               |
| `ocean-user-preferences-v4` | Ocean App        | Stores currency, selected chains, bookmarks, and onboarding flags.  | `localStorage`; persistent.          |
| `sessionToken`              | SSI Auth         | Stores SSI session token (session ID, bearer token, expiration).    | `localStorage`; persistent.          |
| `cachedCredentials`         | SSI Flow         | Caches verifiable credentials per DID to speed up access.           | `localStorage`; persistent.          |
| `credential_<assetId>`      | Access Control   | Stores timestamp of successful credential checks.                   | `localStorage`; persistent.          |
| `compute-rerun:<jobId>`     | Compute          | Stores rerun payloads for compute history.                          | `localStorage`; persistent.          |
| `ssiWalletApiOverride`      | SSI Auth         | Stores user-entered SSI API base URL overrides.                     | `sessionStorage`; ends with session. |
| `wc@2:*`                    | WalletConnect    | Persistence for WalletConnect client sessions.                      | `localStorage` and `IndexedDB`.      |

## 4. Managing Consent

When you access the website, you will be able to accept, reject or configure non-essential cookies. You may withdraw or change your consent at any time using the cookie settings panel available on the website. The process for withdrawing consent is as easy as the process used to give it.

## 5. How to Delete or Block Cookies in Your Browser

You can also block or delete cookies through your browser settings. The steps may vary depending on the browser you use (for example Google Chrome, Mozilla Firefox, Safari or Microsoft Edge). Please note that blocking certain cookies — in particular the strictly necessary ones — may affect the proper operation of some parts of the website, such as wallet connections and asset access.

## 6. Cookies and Data from External Services

Where the website includes videos, embedded content or links to external platforms, those services may place their own cookies when you interact with them. Empower-X does not have full control over third-party cookies, and we recommend reviewing the privacy and cookie policies of the relevant services.

In addition, while not all are "cookies", the following services receive data during your use of the marketplace:

- **SSI Wallet API** — processes wallet addresses and credential IDs during verification.
- **Ocean Node** — receives DIDs and consumer addresses for asset downloads or compute jobs, and processes search and filter queries.
- **IPFS (Pinata / gateways)** — used for pinning and retrieving decentralised content.

## 7. Updates to the Cookie Policy

This policy may be updated when the cookies used, the website's technological tools or the applicable law change. The "Last updated" date at the top indicates the most recent changes.
