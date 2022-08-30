const encodeSelector = url => url.replace(/(selector=)(.*)/, (_, p1, p2) => p1 + encodeURIComponent(p2));

Accounts.emailTemplates.sendLoginToken = {
  subject: () => `Your login magic link for ${Accounts.emailTemplates.siteName}`,
  text: (user, url) => `Hello! 👋
Click the following link to be automatically logged in:
${encodeSelector(url)}
Thank you!
`,
  html: (user, url) => `Hello! 👋<br/>
Click the following link to be automatically logged in:<br/><br/>
${encodeSelector(url)}<br/>
Thank you!
`,
};
