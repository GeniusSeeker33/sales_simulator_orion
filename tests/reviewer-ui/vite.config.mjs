import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const fixture = name => fileURLToPath(new URL('./' + name, import.meta.url));
export default defineConfig({
  plugins:[react()],
  resolve:{alias:[
    {find:/.*\/lib\/learnerClient(?:\.js)?$/,replacement:fixture('mock-client.js')},
    {find:/.*\/context\/AuthContext(?:\.jsx)?$/,replacement:fixture('mock-auth.jsx')},
  ]},
  server:{host:'127.0.0.1',port:5179,strictPort:true},
});
