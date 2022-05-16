const express      = require('express')
const cookieParser = require('cookie-parser')
const fs           = require('fs')
const svgCaptcha   = require('svg-captcha')
const md5          = require('md5')


const PORT     = 8080
const app      = express()
const users    = JSON.parse(fs.readFileSync('./users.json'))
const posts    = JSON.parse(fs.readFileSync('./posts.json'))
const comments = JSON.parse(fs.readFileSync('./comments.json'))


function timeLocale() {
  return new Date().toLocaleString()
}
/** Converts the characters "&", "<", ">", '"',
 * and "'" in string to their corresponding HTML entities.
 * @param {*} str
 * @returns {String}
 */
function escapeHTML(str) {
  // 防止 sxx 攻击
  str = str.toString()

  str = str.split('&').join('&amp;')
  str = str.split('<').join('&lt;')
  str = str.split('>').join('&gt;')
  str = str.split('"').join('&quot;')
  str = str.split("'").join('&#39;')

  return str
}


app.use((req, res, next) => {
  console.log(req.method, req.url)

  next()
})

// 解码 url 编码请求体
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser('bbs'))

// 防止 xss 攻击
app.post('*', (req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      let newHTML = escapeHTML(req.body[key])
      if (newHTML != req.body[key]) {
        console.warn('xss!!!', req.body[key])
        req.body[key] = '' // 后续会过滤掉长度为 0 的 post
      }
    }
  }

  next()
})

// 将当前登录用户保存到 req.body.self
app.get('*', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    req.body.self = users.find(it =>
      it.username == req.signedCookies.loginUser
    )
  }

  next()
})

// ./
app.get('/', (req, res, next) => {
  res.type('html').render('index.pug', {
    posts: posts.slice(-10).reverse(),
    loginUser: req.signedCookies.loginUser
      ? req.body.self : null,
  })

  next()
})

const sessionObjs = {}
app.use(function sessionMW(req, res, next) {
  if (!req.cookies.sessionID) {
    let sessionID = Date.now()
    res.cookie('sessionID', sessionID)
    req.cookies.sessionID = sessionID
  }

  req.session = sessionObjs[req.cookies.sessionID] ?? (sessionObjs[req.cookies.sessionID] = {})

  next()
})

// user
app.get('/user/:username', (req, res, next) => {

  let user = users.find(it =>
    it.username == req.params.username
  )

  if (user) {
    let userPosts = posts.filter(it =>
      it.author == user.username
    )

    res.type('html').render('user.pug', {
      loginUser: req.signedCookies.loginUser
        ? req.body.self : null,
      user: user,
      userPosts: userPosts
    })
  } else res.type('html').render('404.pug')

  next()
})


// register
app.get('/register', (req, res, next) => {
  res.type('html').render('register.pug')

  next()
})
app.post('/register', (req, res, next) => {
  // 防止传来 脏数据
  let userInfo = {
    username: req.body.username,
    email   : req.body.email,
    password: md5(req.body.password + md5(req.body.password.length)),
    isDelete: false,
    joinDate: Date.now()
  }

  if ( // username | email 已经存在
    users.some(it =>
      it.username == userInfo.username ||
      it.email == userInfo.email
    )
  ) res.type('html').render('registerErr.pug')
  else {
    users.push(userInfo)
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2))
    res.type('html').render('registerErrS.pug')
  }

  next()
})


// login
app.get('/login', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    res.redirect('/')
  } else res.type('html').render('login.pug', {
    loginErrCount: req.session.loginErrCount
  })

  next()
})
app.post('/login', (req, res, next) => {
  // 防止传来 脏数据
  let loginInfo = {
    username: req.body.username,
    password: md5(req.body.password + md5(req.body.password.length))
  }

  let captcha = req.body.captcha
    ? req.session.captcha == req.body.captcha
    : true

  let user = users.find(it =>
    it.username == loginInfo.username &&
    it.password == loginInfo.password
  )

  if (user && captcha) {
    res.cookie('loginUser', loginInfo.username, {
      maxAge: 86400000, // 一天
      signed: true,
    })
    req.session.loginErrCount = 0
    res.redirect('/')
  } else {
    req.session.loginErrCount = (req.session.loginErrCount ?? 0) + 1
    res.type('html').render('loginErr.pug', {captcha})
  }

  next()
})


app.get('/captcha', (req, res, next) => {
  let captcha = svgCaptcha.create({
    color: true,
    noise: 4,
    ignoreChars: '0oOI1i'
  })
  req.session.captcha = captcha.text
  res.type('svg').end(captcha.data)

  next()
})


// logout
app.get('/logout', (req, res, next) => {
  let back = req.get('referer') ?? '/'

  res.clearCookie('loginUser')
  res.redirect(back) // 回到主页

  next()
})


// post
app.get('/post/:id', (req, res, next) => {
  let post = posts.find(it => it.id == req.params.id)

  if (post) {
    let thisComments = comments.filter(it =>
      it.postID == post.id
    )

    res.type('html').render('post.pug', {
      loginUser: req.body.self,
      post,
      thisComments
    })
  } else res.type('html').render('404.pug')

  next()
})
app.post('/post', (req, res, next) => {
  // 已登录用户才可发帖
  if (req.signedCookies.loginUser) {
    // 防止传来 脏数据
    let postInfo = {
      id      : `${Date.now()}`,               // 待定
      title   : req.body.title,
      text    : req.body.text,
      author  : req.signedCookies.loginUser,
      date    : timeLocale(),
      isDelete: false
    }

    if (postInfo.title?.length && postInfo.text?.length) {
      posts.push(postInfo)
      fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2))
    }
    res.redirect(`/post/${postInfo.id}`)
  }

  next()
})


// comment
app.post('/comment/:postID', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    // 防止传来 脏数据
    let commentInfo = {
      id      : `${Date.now()}`,
      postID  : req.params.postID,
      text    : req.body.text,
      date    : timeLocale(),
      author  : req.signedCookies.loginUser,
      isDelete: false
    }
    comments.push(commentInfo)
    fs.writeFileSync('./comments.json', JSON.stringify(comments, null, 2))
    res.redirect(`/post/${req.params.postID}`)
  } else res.redirect('/login')

  next()
})


app.listen(PORT, '127.0.0.1', () => {
  console.log('Listening on', PORT)
})
