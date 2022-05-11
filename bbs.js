const express = require('express')
const cookieParser = require('cookie-parser')
const fs = require('fs')


const PORT = 8080
const app = express()
const users = JSON.parse(fs.readFileSync('./users.json'))
const posts = JSON.parse(fs.readFileSync('./posts.json'))
const comments = JSON.parse(fs.readFileSync('./comments.json'))


function timeISO() {
  return new Date().toISOString()
}
function timeLocale(time) {
  return new Date(time).toLocaleString()
}

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
  } else {
    res
      .type('html')
      .write(`
        <a href="/register">register</a>
        <a href="/login">login</a>
      `)
  }

  // 未登录也可查看帖子
  res.write('<hr><ul>')
  for (let post of posts) {
    // date 转为 本地化时间，
    // 存的时候为 new Date().toISOString()
    res.write(`
      <li>
        <a href="/post/${post.id}">${post.title}</a>
        <span><a href="/user/${post.author}">@${post.author}</a></span>
        <span>${timeLocale(post.date)}</span>
      </li>
    `)
  }
  res.end('</ul>')

  next()
})


// user
app.get('/user/:username', (req, res, next) => {
  // Array.prototype.find() return 'it' not boolean
  let user = users.find(it => it.username == req.params.username)
  if (user) {
    // header 显示内容
    if (req.signedCookies.loginUser) {
      let self = users.find(it => it.username == req.signedCookies.loginUser)
      res
        .type('html')
        .write(`
          <h1>hello,
            <a href="/user/${req.signedCookies.loginUser}">
              ${req.signedCookies.loginUser}
            </a>
          </h1>
          <span>已加入 ${(Date.now() - self.joinDate) / 86400000 >> 0} 天</span>
          <a href="/">home</a>
          <a href="/logout">logout</a>
          <a href="/setting">setting</a>
        `)
    } else {
      res
        .type('html')
        .write(`
          <a href="/">home</a>
          <a href="/register">register</a>
          <a href="/login">login</a>
        `)
    }

    res.write('<hr>')
    // 查看的用户信息
    // 查看的用户不是自己时
    if (req.signedCookies.loginUser != user.username) {
      res.write(`
        <h1>username:
          <a href="/user/${user.username}">
            ${user.username}
          </a>
        </h1>
        <span>已加入 ${(Date.now() - user.joinDate) / 86400000 >> 0} 天</span>
        <hr>
      `)
    }

    // 加载发布过的帖子
    res.write('<ul>')
    let thisPosts = posts.filter(it => it.author == user.username)
    for (let it of thisPosts) {
      // date 转为 本地化时间，
      // 存的时候为 new Date().toISOString()
      res.write(`
        <li>
          <a href="/post/${it.id}">${it.title}</a>
          <span>${timeLocale(it.date)}</span>
        </li>
      `)
    }
    res.end('</ul>')
  } else res.end(`Not fount user ${req.params.username}`)

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
  // 防止传来 脏数据
  let userInfo = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.email,
    isDelete: false,
    joinDate: Date.now()
  }

  if ( // username | email 已经存在
    users.some(it => it.username == userInfo.username) ||
    users.some(it => it.email == userInfo.email)
  ) {
    res
      .type('html')
      .end('username or email already exists, <a href="/register">back register</a>')
  } else {
    users.push(userInfo)
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

  let user = users.find(it =>
    it.username == loginInfo.username &&
    it.password == loginInfo.password
  )
  if (user) {
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
    // 登录用户可发表评论
    if (req.signedCookies.loginUser) {
      res
        .type('html')
        .write(`
          <h1>hello,
            <a href="/user/${req.signedCookies.loginUser}">
            ${req.signedCookies.loginUser}</a>
          </h1>
          <a href="/">home</a>
          <a href="/register">register</a>
          <a href="/logout">logout</a>
          <hr>
          <div>
            <h2>${post.title}</h2>
            <span>${timeLocale(post.date)}</span>
            <span><a href="/user/${post.author}">@${post.author}</a></span>
            <p>${post.text}</p>
          </div>
          <hr>
        `)

      // 加载已有评论
      let thisComments = comments.filter(it => it.postID == req.params.id)
      for (let comment of thisComments) {
        res.write(`
          <a href="/user/${comment.author}">${comment.author}</a>
          <span>${timeLocale(comment.date)}</span>
          <p>${comment.text}</p>
        `)
      }

      res.end(`
        <h2>回复帖子</h2>
        <form action="/comment/${req.params.id}" method="post">
          <textarea name="text" cols="30" rows="10"></textarea>
          <button type="submit">发表评论</button>
        </form>
      `)
    } else {
      res
        .type('html')
        .end(`
          <a href="/">home</a>
          <a href="/register">register</a>
          <a href="/login">login</a>

          <div>
            <h2>${post.title}</h2>
            <span>${timeLocale(post.date)}</span>
            <span><a href="/user/${post.author}">@${post.author}</a></span>
            <p>${post.text}</p>
          </div>

          <a href="/login">请登录后 查看/发表 评论</a>
        `)
    }
  } else {
    res.end(`Not fount post ${req.params.id}`)
  }
  next()
})
app.post('/post', (req, res, next) => {
  // 已登录用户才可发帖
  if (req.signedCookies.loginUser) {
    // 防止传来 脏数据
    let postInfo = {
      id: `${Date.now()}`, // 待定
      title: req.body.title,
      text: req.body.text,
      author: req.signedCookies.loginUser,
      date: timeISO(),
      isDelete: false
    }

    posts.push(postInfo)
    fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2))
    res.redirect('/')
  } else res.end('only logged in user can post')

  next()
})


// comment
app.post('/comment/:postID', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    // 防止传来 脏数据
    let commentInfo = {
      id: `${Date.now()}`,
      postID: req.params.postID,
      text: req.body.text,
      date: timeISO(),
      author: req.signedCookies.loginUser,
      isDelete: false
    }
    comments.push(commentInfo)
    fs.writeFileSync('./comments.json', JSON.stringify(comments, null, 2))
    res.redirect(`/post/${req.params.postID}`)
  } else {
    res.end('please login to comment')
  }

  next()
})



app.listen(PORT, '127.0.0.1', () => {
  console.log('Listening on', PORT)
})
