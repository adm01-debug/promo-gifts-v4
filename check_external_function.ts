async function checkFunction() {
  const url = 'https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1/log-login-attempt';
  const response = await fetch(url, { method: 'OPTIONS' });
  console.log('Function OPTIONS status:', response.status);
}
checkFunction();
