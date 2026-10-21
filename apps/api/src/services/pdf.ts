export async function renderPDF(html:string,env:{CF_ACCOUNT_ID?:string;BROWSER_RENDERING_API_TOKEN?:string}) {
  if(!env.CF_ACCOUNT_ID||!env.BROWSER_RENDERING_API_TOKEN)return null;
  if(!/^[a-f\d]{32}$/i.test(env.CF_ACCOUNT_ID))throw new Error('PDF_ACCOUNT_INVALID');
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/pdf`,{method:'POST',headers:{Authorization:`Bearer ${env.BROWSER_RENDERING_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({html,pdfOptions:{format:'a4',printBackground:true}})});
  if(!response.ok)throw new Error('PDF_RENDER_FAILED');
  return response.arrayBuffer();
}
