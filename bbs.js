const express      = require('express')
const cookieParser = require('cookie-parser')
const fs           = require('fs')


const PORT  = 8080
const app   = express()
const users = JSON.parse(fs.readFileSync('./users.json'))

/*
  http://localhost:8080/
  http://localhost:8080/post/post:id
  http://localhost:8080/user/user:id

  http://localhost:8080/login
  http://localhost:8080/register
  http://localhost:8080/forget

*/

app.use((req, res, next) => {
  console.log(req.method, req.url)
  next()
})

// 解码 url 编码请求体
app.use(express.urlencoded({extended: true}))
app.use(cookieParser('bbs'))
app.use((req, res, next) => {
  console.log(req.cookies, req.signedCookies)
  next()
})

// ./
app.get('/', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    res.type('html')
    res.end(`
      <h1>hello,
        <a href="/user/${req.signedCookies.loginUser}">
        ${req.signedCookies.loginUser}</a>
      </h1>
      <a href="/register">register</a>
      <a href="/logout">logout</a>
    `)
  } else {
    res.type('html')
    res.end(`
      <a href="/login">login</a>
      <a href="/register">register</a>
    `)
  }

  next()
})

// register
app.get('/register', (req, res, next) => {
  res.type('html')
  res.end(`
    <h1>register</h1>
    <form action="/register" method="post">
      <div>Name: <input name="username" type="text"></div>
      <div>Email: <input name="email" type="email"></div>
      <div>Password: <input name="password" type="password"></div>
      <div>Password-2: <input type="password"></div>
      <button type="submit">register</button>
    </form>
  `)

  next()
})
app.post('/register', (req, res, next) => {
  let regInfo = req.body

  if ( // username | email 已经存在
    users.some(it => it.username == regInfo.username) ||
    users.some(it => it.email == regInfo.email)
  ) {
    res.type('html')
    res.end('username or email already exists, <a href="/register">back register</a>')
  } else {
    users.push(regInfo)
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2))
    res.type('html')
    res.end('register success, <a href="/login">go to login</a>')
  }

  next()
})

// login
app.get('/login', (req, res, next) => {
  res.type('html')
  res.end(`
    <h1>login</h1>
    <form action="/login" method="post">
      <div>Name: <input name="username" type="text"></div>
      <div>Password: <input name="password" type="password"></div>
      <button type="submit">login</button>
    </form>
  `)

  next()
})
app.post('/login', (req, res, next) => {
  let loginInfo = req.body

  if (users.find(it =>
    it.username == loginInfo.username &&
    it.password == loginInfo.password
  )) {
    res.cookie('loginUser', loginInfo.username, {
      maxAge: 86400000, // 单位 毫秒 一天
      signed: true,
    })
    res.redirect('/')
  } else {
    res.type('html')
    res.end('username or password incorrect, <a href="/register">go to register</a>')
  }

  next()
})

// logout
app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  res.redirect('/') // 回到主页
  next()
})

app.listen(PORT, () => {
  console.log('Listening on', PORT)
})
