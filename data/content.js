/* =========================================================
   content.js —— 你唯一需要改的内容文件
   ---------------------------------------------------------
   ★ 坐标怎么来？
     打开 tools/hotspot-editor.html，把房间图拖进去，
     点一下物件，就能拿到 x / y / d 三个数字，粘回这里。

   ★ 字段速查
     x, y : 物件中心点，占整张图的百分比（左上角是 0,0）
     d    : 点击圈直径，是"图宽"的百分比（8 = 图宽的 8%）
     kind : "memory" 打开故事 | "granny" 和奶奶说话 | "scene" 走去另一个房间
     story: { title, body:[段落…], audio, audioLabel, transcript, photos:[…] }
     phases: 哪些时间段出现；省略就是一直都在

   ★ 换成自己的素材
     把 assets/art 里的占位图换成 Procreate 导出的图片，
     再改下面 scenes.*.art 的路径即可。建议 16:9（例如 3200×1800）。
   ========================================================= */

window.CONTENT = {

  meta: {
    title: "奶奶的房间",
    kicker: "a room, kept",
    lead: "这是她住了四十年的屋子。沙发左边的灯绳，抽屉第二格的顶针，还有灶台上那只用旧了的铁锅。\n走进来，随便看看。",
    enterLabel: "推门进去",
    hint: "戴上耳机，慢慢来",
    // 顶部小字，留空就隐藏
    brand: "奶奶的房间"
  },

  /* ---------------- 封面：散落的旧照片 ---------------- */
  introPhotos: [
    { src: "assets/photos/photo-1.svg", x: 8,  y: 12, w: 15, rot: -7,  year: "1962" },
    { src: "assets/photos/photo-2.svg", x: 76, y: 8,  w: 13, rot: 6,   year: "1971" },
    { src: "assets/photos/photo-3.svg", x: 63, y: 62, w: 17, rot: -4,  year: "1980" },
    { src: "assets/photos/photo-4.svg", x: 14, y: 58, w: 14, rot: 8,   year: "1988" },
    { src: "assets/photos/photo-5.svg", x: 40, y: 76, w: 11, rot: -11, year: "1996" },
    { src: "assets/photos/photo-6.svg", x: 88, y: 40, w: 10, rot: 12,  year: "2003" }
  ],

  /* ---------------- 时间：房间怎么变 ----------------
     after = 看到多少段记忆之后切换。最后一段之后一直保持。
     overlay 见 style.css 里 body[data-phase=...] 的规则。
     art 可以留空：留空就用 scenes.*.art。          */
  phases: [
    { id: "day",   after: 0, overlay: "day",
      granny: "坐吧，别站着。",
      art: { living: "assets/art/living-room.svg", kitchen: "assets/art/kitchen.svg" } },

    { id: "dusk",  after: 3, overlay: "dusk",
      granny: "这个点光最好看，斜斜地照进来。",
      art: { living: "assets/art/living-room.svg", kitchen: "assets/art/kitchen.svg" } },

    { id: "night", after: 6, overlay: "night",
      granny: "天黑啦？把灯拉着。我不困，你再说会儿话。",
      art: { living: "assets/art/living-room.svg", kitchen: "assets/art/kitchen.svg" } }
  ],

  /* ---------------- 房间 ---------------- */
  scenes: {

    /* ============ 客厅 ============ */
    living: {
      name: "客厅",
      art: "assets/art/living-room.svg",
      alt: "客厅：一张旧沙发，沙发旁是奶奶常坐的椅子，右边一张缝纫机桌，墙上有窗和一排玻璃罐。",
      ambient: "",   // 例如 "assets/audio/ambient-living.mp3"

      hotspots: [
        {
          id: "lamp", label: "吊灯", kind: "memory",
          x: 51, y: 14, d: 9,
          story: {
            title: "灯绳",
            sample: true,
            body: [
              "灯的开关是一根白棉线，垂在桌子正上方，谁进门都伸手拉一下。",
              "（示例文字：这里可以写灯绳、拉线开关、或者每次回家先拉灯的那个动作。）"
            ],
            audio: "",
            audioLabel: "奶奶说这个灯",
            transcript: "",
            photos: [
              { src: "assets/photos/photo-3.svg", caption: "示例照片：客厅全景", year: "1980" },
              { src: "assets/photos/photo-5.svg", caption: "示例照片：过年", year: "1996" }
            ]
          }
        },
        {
          id: "jars", label: "玻璃罐", kind: "memory",
          x: 26, y: 27, d: 15,
          story: {
            title: "一排玻璃罐",
            sample: true,
            body: [
              "架子上排着七八只罐子，装着白糖、黄豆、陈皮和说不清是什么的东西。罐子上贴的是她自己剪的纸片，字歪歪的。",
              "（示例文字：罐子里装的是什么，有没有哪一罐是你小时候偷吃过的。）"
            ],
            audio: "",
            transcript: "",
            photos: [
              { src: "assets/photos/photo-4.svg", caption: "示例照片：厨房窗台", year: "1988" }
            ]
          }
        },
        {
          id: "window", label: "窗", kind: "memory",
          x: 73, y: 29, d: 18,
          story: {
            title: "窗子朝南",
            sample: true,
            body: [
              "窗子朝南，冬天太阳会走到沙发上。她每天下午三点左右挪一次椅子，就为了跟着那块光。",
              "（示例文字：窗外是什么？她坐在窗边做什么？）"
            ],
            audio: "",
            transcript: "",
            photos: []
          }
        },
        {
          id: "calendar", label: "日历", kind: "memory",
          x: 32, y: 45, d: 8,
          phases: ["day", "dusk"],
          story: {
            title: "日历上写字",
            sample: true,
            body: [
              "一页一张的日历，空白处被她写满了：谁哪天生孩子，哪天该买煤，哪天停电。",
              "（示例文字：日历上写过什么？她怎么记日子？）"
            ],
            audio: "",
            transcript: "",
            photos: [
              { src: "assets/photos/photo-2.svg", caption: "示例照片：搬进这套房子那年", year: "1971" }
            ]
          }
        },
        {
          id: "sofa", label: "沙发", kind: "memory",
          x: 20, y: 65, d: 20,
          story: {
            title: "沙发上的凹痕",
            sample: true,
            body: [
              "沙发是墨绿色的绒布，右边那个位置坐出了一个不太回弹的坑。客人来了也不坐那个位置。",
              "（示例文字：谁总坐这里？沙发套什么时候换的？）"
            ],
            audio: "",
            transcript: "",
            photos: [
              { src: "assets/photos/photo-6.svg", caption: "示例照片：祖孙两人", year: "2003" }
            ]
          }
        },
        {
          id: "radio", label: "收音机", kind: "memory",
          x: 65, y: 60, d: 13,
          story: {
            title: "下午四点的收音机",
            sample: true,
            body: [
              "四点有一档评书。她一边择菜一边听，听到要紧处手就停下来，菜叶上的水一直滴到地上。",
              "（示例文字：她听什么？戏曲、评书、还是新闻？）"
            ],
            audio: "",
            audioLabel: "收音机里的声音（示例）",
            transcript: "（示例：如果有录音，把听不清的部分写成文字放在这里。既方便听不清的人，也方便以后。）",
            photos: []
          }
        },
        {
          id: "sewing", label: "缝纫机", kind: "memory",
          x: 81, y: 62, d: 14,
          story: {
            title: "缝纫机",
            sample: true,
            body: [
              "蝴蝶牌的，脚踩的那种。她踩起来的时候，整个人跟着轻轻晃。桌角有一只铁盒，里面全是扣子和线轴。",
              "（示例文字：她给你缝过什么？谁教她的？）"
            ],
            audio: "",
            transcript: "",
            photos: [
              { src: "assets/photos/photo-1.svg", caption: "示例照片：年轻时候", year: "1962" }
            ]
          }
        },
        {
          id: "cat", label: "地毯上的猫", kind: "memory",
          x: 50, y: 87, d: 11,
          phases: ["day", "dusk"],
          story: {
            title: "它总睡在光里",
            sample: true,
            body: [
              "一只黄白花猫，不管家里多吵，它只在有太阳的那块地毯上睡。",
              "（示例文字：家里的猫、狗，或者别的什么活物。）"
            ],
            audio: "",
            transcript: "",
            photos: []
          }
        },
        {
          id: "to-kitchen", label: "去厨房", kind: "scene", to: "kitchen",
          x: 8, y: 55, d: 13
        },
        {
          // 奶奶自己也是一个热点，坐标画在她的椅子/人身上
          id: "granny", label: "和奶奶说说话", kind: "granny",
          x: 48, y: 58, d: 17
        }
      ]
    },

    /* ============ 厨房 ============ */
    kitchen: {
      name: "厨房",
      art: "assets/art/kitchen.svg",
      alt: "厨房：左边是灶台和铁锅，中间一张木桌，右边一个碗柜，窗下是水池。",
      ambient: "",

      hotspots: [
        {
          id: "wok", label: "铁锅", kind: "memory",
          x: 20, y: 50, d: 15,
          story: {
            title: "那口铁锅",
            sample: true,
            body: [
              "锅底是黑的，锅沿被磨得发亮。她说新锅要用肥肉擦一遍，之后怎么用都不粘。",
              "（示例文字：她最拿手的一道菜是什么？做法里有什么别人不知道的小动作？）"
            ],
            audio: "assets/audio/sample-tone.wav",
            audioLabel: "示例音频：换成奶奶的录音",
            transcript: "（示例：把录音里说的话打在这里。很多人会先读文字，再决定要不要听。）",
            photos: [
              { src: "assets/photos/photo-4.svg", caption: "示例照片：灶台", year: "1988" }
            ]
          }
        },
        {
          id: "table", label: "木桌", kind: "memory",
          x: 50, y: 66, d: 17,
          story: {
            title: "在这张桌子上",
            sample: true,
            body: [
              "包饺子、写作业、拆毛衣、晾凉刚出锅的馒头——都在这张桌子上。桌面上有一道很深的刀痕，是剁排骨的时候留下的。",
              "（示例文字：这张桌子发生过什么？）"
            ],
            audio: "",
            transcript: "",
            photos: [
              { src: "assets/photos/photo-5.svg", caption: "示例照片：过年包饺子", year: "1996" }
            ]
          }
        },
        {
          id: "thermos", label: "暖水瓶", kind: "memory",
          x: 70, y: 57, d: 8,
          story: {
            title: "两瓶开水",
            sample: true,
            body: [
              "每天烧两瓶水，灌进那个红牡丹花的暖瓶。她睡前一定要留半瓶，说夜里万一要喝。",
              "（示例文字：她的习惯、她坚持的事情。）"
            ],
            audio: "",
            transcript: "",
            photos: []
          }
        },
        {
          id: "cupboard", label: "碗柜", kind: "memory",
          x: 79, y: 42, d: 16,
          story: {
            title: "碗柜第二格",
            sample: true,
            body: [
              "碗柜第二格靠里的位置放着一个铁皮盒，装顶针、线和几张谁也不知道为什么留着的票据。",
              "（示例文字：碗柜里有什么？哪一格是不许动的那一格？）"
            ],
            audio: "",
            transcript: "",
            photos: [
              { src: "assets/photos/photo-2.svg", caption: "示例照片", year: "1971" }
            ]
          }
        },
        {
          id: "sink", label: "水池", kind: "memory",
          x: 50, y: 25, d: 14,
          story: {
            title: "洗菜的窗",
            sample: true,
            body: [
              "水池上方是窗。洗菜的时候抬头能看见对面楼，看见谁家晾了被子，也看见天要下雨了。",
              "（示例文字：从这里看出去是什么？）"
            ],
            audio: "",
            transcript: "",
            photos: []
          }
        },
        {
          id: "to-living", label: "回客厅", kind: "scene", to: "living",
          x: 7, y: 55, d: 13
        },
        {
          id: "granny-kitchen", label: "和奶奶说说话", kind: "granny",
          x: 30, y: 67, d: 16
        }
      ]
    }
  },

  /* ---------------- 奶奶会说的话 ----------------
     优先顺序：看到某段记忆后的回应 → 当前时间段的台词 → 随机一句。

     perMemory 的 key = 热点 id。
     不必每段记忆都写，留空的就走随机。            */
  granny: {
    greetings: [
      "哎，你来了。坐吧。",
      "别站着，坐下来说。"
    ],
    idle: [
      "这屋子旧了，可东西都还在原来的地方。",
      "你小时候啊，一到吃饭就满屋子跑。",
      "慢点看，不着急。",
      "抽屉里有糖，自己拿。"
    ],
    perPhase: {
      day: "外头风大不大？",
      dusk: "天快黑了，把窗关上一半。",
      night: "夜深了，别急着走。"
    },
    perMemory: {
      "lamp": "这灯费电，我平时舍不得开。",
      "jars": "那罐里是陈皮，泡水喝。给你留的。",
      "window": "太阳走到沙发上，我就知道该做饭了。",
      "calendar": "日子不写下来，就不知道过到哪儿了。",
      "sofa": "你妈小时候从这沙发上摔下去过，哭得可凶。",
      "radio": "四点有评书，你听听。",
      "sewing": "这台机器，踩快了会咬布。",
      "cat": "它又叫了吧？准是要吃的。",
      "wok": "锅要热了再下菜，别急着翻。",
      "table": "桌子擦擦就能用，别管那道印子。",
      "thermos": "暖瓶里还有水，自己倒。",
      "cupboard": "碗柜第二格别动，我放着东西。",
      "sink": "洗菜呢，你等一会儿。"
    }
  }
};
