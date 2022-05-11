const express = require('express')
const cookieParser = require('cookie-parser')
const fs = require('fs')


const PORT = 8080
const app = express()
const users = JSON.parse(fs.readFileSync('./users.json'))
const posts = JSON.parse(fs.readFileSync('./posts.json'))

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
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser('bbs'))

// app.use((req, res, next) => {
//   console.log(req.cookies, req.signedCookies)
//   next()
// })

// ./
app.get('/', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    res
      .type('html')
      .write(`
        <h1>hello,
          <a href="/user/${req.signedCookies.loginUser}">
          ${req.signedCookies.loginUser}</a>
        </h1>
        <a href="/register">register</a>
        <a href="/logout">logout</a>

        <form action="/post" method="post">
          <span>title</span><input type="text" name="title"><br>
          <span>text</span><br>
          <textarea name="text" cols="30" rows="10"></textarea><br>
          <input type="submit" value="post">
        </form>
      `)

    res.write('<hr><ul>')
    for (let post of posts) {
      // date 转为 本地化时间，
      // 存的时候为 new Date().toISOString()
      res.write(`
        <li>
          <a href="/post/${post.id}">${post.title}</a>
          <span><a href="/user/${post.author}">@${post.author}</a></span>
          <span>${new Date(post.date).toLocaleString()}</span>
        </li>
      `)
    }
    res.end('</ul>')

  } else {
    res
      .type('html')
      .end(`
        <a href="/login">login</a>
        <a href="/register">register</a>
      `)
  }

  next()
})

// register
app.get('/register', (req, res, next) => {
  res
    .type('html')
    .end(`
      <h1>register</h1>
      <a href="/">home</a>
      <a href="/login">login</a>
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
  // 防止传来 脏数据
  regInfo = {
    username: regInfo.username,
    email   : regInfo.email,
    password: regInfo.email
  }

  if ( // username | email 已经存在
    users.some(it => it.username == regInfo.username) ||
    users.some(it => it.email == regInfo.email)
  ) {
    res
      .type('html')
      .end('username or email already exists, <a href="/register">back register</a>')
  } else {
    users.push(regInfo)
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2))
    res
      .type('html')
      .end('register success, <a href="/login">go to login</a>')
  }

  next()
})

// login
app.get('/login', (req, res, next) => {
  res
    .type('html')
    .end(`
      <h1>login</h1>
      <a href="/">home</a>
      <a href="/register">register</a>
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
  // 防止传来 脏数据
  loginInfo = {
    username: loginInfo.username,
    password: loginInfo.password
  }

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
    res
      .type('html')
      .end('username or password incorrect, <a href="/register">go to register</a>')
  }

  next()
})

// logout
app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  res.redirect('/') // 回到主页
  next()
})

// post
app.get('/post/:id', (req, res, next) => {
  let post = posts.find(it => it.id == req.params.id)
  if (post) {
    res.end(`
      <h1>hello,
        <a href="/user/${req.signedCookies.loginUser}">
        ${req.signedCookies.loginUser}</a>
      </h1>
      <a href="/">home</a>
      <a href="/register">register</a>
      <a href="/logout">logout</a>

      <div>
        <h2>${post.title}</h2>
        <span>${new Date(post.date).toLocaleString()}</span>
        <span><a href="/user/${post.author}">@${post.author}</a></span>
        <p>${post.text}</p>
      </div>
    `)
  } else {
    res.end(`Not fount post ${req.params.id}`)
  }
  next()
})
app.post('/post', (req, res, next) => {
  // 已登录用户才可发帖
  if (req.signedCookies.loginUser) {
    let postInfo = req.body
    // 防止传来 脏数据
    postInfo = {
      id      : Date.now(),
      title   : postInfo.title,
      text    : postInfo.text,
      author  : req.signedCookies.loginUser,
      date    : new Date().toISOString(),
      isDelete: false
    }

    posts.push(postInfo)
    fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2))
    res.redirect('/')
  } else res.end('only logged in user can post')

  next()
})

app.listen(PORT, '127.0.0.1', () => {
  console.log('Listening on', PORT)
})
