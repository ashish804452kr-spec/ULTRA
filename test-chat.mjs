const res = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'hello', history: [] })
});
console.log('Status:', res.status);
console.log(await res.text());
