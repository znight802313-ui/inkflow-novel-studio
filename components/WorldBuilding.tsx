
import React, { useState, useEffect } from 'react';
import { NovelSettings, Character, Faction, Location, AvailableModel, Chapter } from '../types';
import { generateWorldBuilding, syncPlotBatch, generateCoverImage, extractWritingStyle, generateCharacterAvatars } from '../services/geminiService';

/* --- Helper Components for the aesthetic layout --- */

interface CardProps {
  children: React.ReactNode;
  icon: string;
  title: string;
  action?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, icon, title, action }) => (
  <div className="group relative">
    {/* Outer glow layer - creates depth */}
    <div className="absolute -inset-1 bg-gradient-to-br from-amber-500/20 via-purple-500/20 to-blue-500/20 rounded-[28px] blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

    {/* Main card with enhanced 3D effect */}
    <div className="relative backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 border-2 border-amber-500/30 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(251,191,36,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.5),0_4px_16px_rgba(251,191,36,0.2)] transition-all duration-500 overflow-hidden">

      {/* Inner border highlight for 3D effect */}
      <div className="absolute inset-0 rounded-3xl border border-white/5 pointer-events-none" />

      {/* Top edge highlight */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

      {/* Ambient glow effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-amber-500/15 via-purple-500/15 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-blue-500/15 via-purple-500/15 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            {/* Enhanced icon container with 3D effect */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 via-purple-500/30 to-blue-500/30 rounded-xl blur-md" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/25 via-purple-500/25 to-blue-500/25 border-2 border-amber-500/40 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                <span className="text-2xl filter drop-shadow-[0_0_16px_rgba(251,191,36,0.8)]">{icon}</span>
              </div>
            </div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-amber-200 via-purple-200 to-blue-200 bg-clip-text text-transparent tracking-wide uppercase drop-shadow-[0_2px_8px_rgba(251,191,36,0.3)]">
              {title}
            </h3>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  </div>
);

const InputField: React.FC<{ label: string, value: string, onChange: (v: string) => void, placeholder?: string }> = ({ label, value, onChange, placeholder = "" }) => (
  <div className="flex-1">
    <label className="block text-xs font-bold bg-gradient-to-r from-amber-400/80 to-purple-400/80 bg-clip-text text-transparent uppercase tracking-wider mb-3 ml-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full backdrop-blur-sm bg-slate-950/60 border border-amber-500/30 rounded-2xl px-5 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400/60 transition-all shadow-xl hover:shadow-amber-500/5"
    />
  </div>
);

const TextAreaField: React.FC<{ label: string, value: string, onChange: (v: string) => void, rows: number, placeholder?: string, className?: string, badge?: string }> = ({ label, value, onChange, rows, placeholder = "", className = "", badge }) => (
  <div>
    <div className="flex justify-between items-center mb-3 ml-1">
        <label className="block text-xs font-bold bg-gradient-to-r from-amber-400/80 to-purple-400/80 bg-clip-text text-transparent uppercase tracking-wider">{label}</label>
        {badge && (
          <span className="text-[10px] font-bold bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30 shadow-lg backdrop-blur-sm">
            {badge}
          </span>
        )}
    </div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={`w-full backdrop-blur-sm bg-slate-950/60 border border-amber-500/30 rounded-2xl px-5 py-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400/60 transition-all shadow-xl hover:shadow-amber-500/5 resize-y ${className}`}
    />
  </div>
);

interface WorldBuildingProps {
  settings: NovelSettings;
  chapters: Chapter[];
  onUpdate: (settings: Partial<NovelSettings>) => void;
  setIsLoading: (loading: boolean) => void;
  model: AvailableModel;
}

const WorldBuilding: React.FC<WorldBuildingProps> = ({ settings, chapters, onUpdate, setIsLoading, model }) => {
  const [idea, setIdea] = useState('');

  // States for Sync Workflow
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncDetailLog, setSyncDetailLog] = useState<string>(''); // For detailed progress text
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncConfirmData, setSyncConfirmData] = useState<{
    missingChapters: Chapter[],
    lastSyncedNum: number
  } | null>(null);

  // State for Cover Generation
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverCompositionStyle, setCoverCompositionStyle] = useState<'close-up' | 'wide-scene' | 'mid-atmosphere'>('mid-atmosphere');

  // State for Writing Style Extraction
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [styleInputMode, setStyleInputMode] = useState<'file' | 'text' | 'title'>('file');
  const [styleInputText, setStyleInputText] = useState('');

  // State for Tag Input
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // State for Character Edit Modal
  const [editingCharacter, setEditingCharacter] = useState<{ index: number; character: Character } | null>(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);

  // State for Character Gallery View
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
  const [characterSearchQuery, setCharacterSearchQuery] = useState('');

  // State for Faction Edit Modal and Gallery View
  const [editingFaction, setEditingFaction] = useState<{ index: number; faction: Faction } | null>(null);
  const [isFactionModalOpen, setIsFactionModalOpen] = useState(false);
  const [selectedFactionIndex, setSelectedFactionIndex] = useState(0);
  const [factionSearchQuery, setFactionSearchQuery] = useState('');

  // State for Location Edit Modal and Gallery View
  const [editingLocation, setEditingLocation] = useState<{ index: number; location: Location } | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(0);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');

  // State for Avatar Generation
  const [isGeneratingAvatars, setIsGeneratingAvatars] = useState(false);

  // State for Avatar Selection Modal
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);
  const [avatarSelectorCharIndex, setAvatarSelectorCharIndex] = useState<number | null>(null);
  const [avatarSelectorTab, setAvatarSelectorTab] = useState<'library' | 'upload' | 'ai'>('library');
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([]);
  const [isGeneratingSingleAvatar, setIsGeneratingSingleAvatar] = useState(false);
  const [avatarSearchQuery, setAvatarSearchQuery] = useState('');

  // Load available avatars from public/avatars folder
  useEffect(() => {
    const loadAvatars = async () => {
      try {
        // Load the manifest file that lists all available avatars
        const response = await fetch('/avatars/avatars-manifest.json');
        if (!response.ok) {
          console.warn('Avatar manifest not found. Please run: cd public/avatars && find . -maxdepth 1 -type f \\( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" \\) -exec basename {} \\; | jq -R -s -c \'split("\\n") | map(select(length > 0))\' > avatars-manifest.json');
          return;
        }

        const filenames: string[] = await response.json();
        const avatarPaths = filenames.map(filename => `/avatars/${filename}`);

        console.log(`Loaded ${avatarPaths.length} avatars from manifest`);
        setAvailableAvatars(avatarPaths);
      } catch (error) {
        console.error('Failed to load avatars:', error);
      }
    };

    loadAvatars();
  }, []);

  // Open avatar selector for a character
  const openAvatarSelector = (charIndex: number) => {
    setAvatarSelectorCharIndex(charIndex);
    setIsAvatarSelectorOpen(true);
    setAvatarSelectorTab('library');
    setAvatarSearchQuery(''); // Reset search when opening
  };

  // Select avatar from library
  const selectAvatarFromLibrary = (avatarPath: string) => {
    if (avatarSelectorCharIndex === null) return;

    const updatedCharacters = [...settings.characters];
    updatedCharacters[avatarSelectorCharIndex] = {
      ...updatedCharacters[avatarSelectorCharIndex],
      avatar: avatarPath
    };

    onUpdate({ characters: updatedCharacters });
    setIsAvatarSelectorOpen(false);
    setAvatarSelectorCharIndex(null);
  };

  // Upload avatar from local file
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (avatarSelectorCharIndex === null) return;

    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      alert('文件大小不能超过 2MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      const updatedCharacters = [...settings.characters];
      updatedCharacters[avatarSelectorCharIndex] = {
        ...updatedCharacters[avatarSelectorCharIndex],
        avatar: base64
      };

      onUpdate({ characters: updatedCharacters });
      setIsAvatarSelectorOpen(false);
      setAvatarSelectorCharIndex(null);
    };

    reader.readAsDataURL(file);
  };

  // Generate single avatar with AI
  const handleGenerateSingleAvatar = async () => {
    if (avatarSelectorCharIndex === null) return;

    const character = settings.characters[avatarSelectorCharIndex];
    if (!character) return;

    setIsGeneratingSingleAvatar(true);

    try {
      const avatars = await generateCharacterAvatars(
        [{
          name: character.name,
          gender: character.gender,
          age: character.age,
          description: character.description
        }],
        settings.style || ''
      );

      if (avatars.length > 0) {
        const updatedCharacters = [...settings.characters];
        updatedCharacters[avatarSelectorCharIndex] = {
          ...updatedCharacters[avatarSelectorCharIndex],
          avatar: avatars[0]
        };

        onUpdate({ characters: updatedCharacters });
        setIsAvatarSelectorOpen(false);
        setAvatarSelectorCharIndex(null);
      }
    } catch (error: any) {
      console.error('Failed to generate avatar:', error);
      alert(`生成头像失败: ${error.message || '未知错误'}`);
    } finally {
      setIsGeneratingSingleAvatar(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!idea.trim()) return;
    setIsLoading(true);
    try {
      const result = await generateWorldBuilding(
        idea,
        model,
        settings.novelType,
        settings.targetTotalWords,
        settings.targetChapterCount
      );
      onUpdate(result);
    } catch (e) {
      console.error(e);
      alert('AI 生成失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate avatars for characters without avatars
  const handleGenerateAvatars = async () => {
    if (!settings.characters || settings.characters.length === 0) {
      alert("暂无角色，无法生成头像");
      return;
    }

    // Find characters without avatars (up to 4)
    const charactersNeedingAvatars = settings.characters
      .filter(char => !char.avatar)
      .slice(0, 4);

    if (charactersNeedingAvatars.length === 0) {
      alert("所有角色都已有头像");
      return;
    }

    setIsGeneratingAvatars(true);
    setIsLoading(true);

    try {
      console.log(`Generating avatars for ${charactersNeedingAvatars.length} characters...`);

      const avatars = await generateCharacterAvatars(
        charactersNeedingAvatars.map(char => ({
          name: char.name,
          gender: char.gender,
          age: char.age,
          description: char.description
        })),
        settings.style || ''
      );

      console.log(`Generated ${avatars.length} avatars`);

      // Update characters with avatars
      const updatedCharacters = settings.characters.map(char => {
        const index = charactersNeedingAvatars.findIndex(c => c.name === char.name);
        if (index !== -1 && avatars[index]) {
          return { ...char, avatar: avatars[index] };
        }
        return char;
      });

      onUpdate({ characters: updatedCharacters });
      alert(`成功为 ${avatars.length} 个角色生成头像！`);
    } catch (error: any) {
      console.error("生成头像失败:", error);
      alert(`生成头像失败: ${error.message || '未知错误'}`);
    } finally {
      setIsGeneratingAvatars(false);
      setIsLoading(false);
    }
  };

  // Generate cover prompt only
  const handleGeneratePrompt = () => {
    if (!settings.title) {
      alert("请先设置小说标题");
      return;
    }

    // 简化的模板系统：根据构图风格选择不同的基础描述
    const getStyleTemplate = (genre: string): string => {
      // 默认使用玄幻风格的模板
      const genreTemplates: { [key: string]: string } = {
        '玄幻': '古风玄幻世界，修炼圣地或神秘遗迹，浮空岛屿，能量漩涡，发光符文和法阵，荧光粒子和能量光点，神秘壮观的氛围',
        '修仙': '仙侠意境，仙山福地，云雾缭绕的仙宫楼阁，仙鹤飞翔，灵树仙草，灵泉瀑布，清新淡雅的仙气氛围',
        '都市': '现代都市夜景，高楼大厦，霓虹灯光，玻璃幕墙反射，车流光轨，赛博朋克风格，时尚现代的氛围',
        '科幻': '未来科幻世界，太空站或未来城市，金属机械结构，悬浮飞行器，能量护盾，全息投影，科技粒子和数据流，冷峻未来的氛围',
        '武侠': '中国武侠意境，竹林山崖，古镇寺庙，明月细雨，剑气刀光，水墨画风格，古朴典雅的氛围',
        '言情': '唯美浪漫场景，花海或海边，梦幻建筑，飘落花瓣，柔和光点，温馨梦幻的氛围',
        '悬疑': '悬疑惊悚场景，废弃建筑，阴暗街道，雾气烟雾，神秘符号，压抑诡异的氛围',
        '历史': '历史史诗场景，古代宫殿城墙，雕梁画栋，旗帜飘扬，古代兵器战车，庄重威严的氛围',
        '规则怪谈': '规则怪谈场景，日常场景中的诡异细节，规则告示，扭曲阴影，诡异违和的氛围',
        '末日生存': '末日废土场景，废弃城市废墟，残破建筑，昏黄天空，灰烬辐射，荒凉绝望的氛围',
        '灵异': '灵异恐怖场景，古老宅院或废弃医院，鬼火灵体，雾气弥漫，阴森恐怖的氛围',
        '重生': '重生穿越场景，古今交融，时空裂缝，能量波动，时钟沙漏，奇幻神秘的氛围',
        '无限流': '无限流副本场景，多个副本世界拼接，传送门，任务面板，游戏化元素，科幻游戏的氛围',
        '快穿': '快穿世界场景，多个平行世界交织，时空隧道，螺旋构图，任务卡片，梦幻多彩的氛围',
        '洪荒': '洪荒神话场景，原始洪荒大地，巨大神山，混沌气流，先天灵宝，原始壮阔的氛围'
      };

      // 查找匹配的题材
      for (const [key, value] of Object.entries(genreTemplates)) {
        if (genre?.includes(key)) {
          return value;
        }
      }
      return genreTemplates['玄幻']; // 默认返回玄幻
    };

    const styleElements = getStyleTemplate(settings.style || '');
    const titleText = settings.title || '小说';

    // 根据构图风格生成不同的指令词
    let generatedPrompt = '';

    if (coverCompositionStyle === 'close-up') {
      // 角色特写风格
      generatedPrompt = `超精细人物海报，8K高分辨率，极致细节刻画，电影级质感。近景特写构图：画面核心是角色特写，占据画面中心2/3区域，视角为平视或轻微仰视，增强人物气场。人物细节：面容精致，眼神深邃有神，服饰华丽精美，衣料质感细腻。元素与背景：背景虚化处理，隐约可见${styleElements}的元素轮廓，人物周围环绕着相应的特效粒子，营造氛围感。光线效果：主光源从侧面或斜上方照射，在人物面部形成明暗对比，整体色调符合题材风格。细节质感：皮肤的细腻质感，发丝的飘逸动态，衣料的光泽和纹理，粒子特效的闪烁，画面层次分明（前景人物、中景特效、远景虚化背景）。要有艺术字大标题"${titleText}"，标题样式要符合小说风格，字体上要有相应的视觉元素，排版要合理，要有艺术的气息。画面中只出现书名"${titleText}"这几个字，不要出现其他任何文字、符号或字母。`;
    } else if (coverCompositionStyle === 'wide-scene') {
      // 宏大场景风格
      generatedPrompt = `超精细场景海报，8K高分辨率，极致细节刻画，电影级质感。宏大场景构图：画面展现${styleElements}的壮观景象，视角为广角或鸟瞰，展现场景的震撼感和空间感。场景细节：环境宏大壮丽，建筑或地貌细节丰富，远近层次分明。元素与背景：天空或背景呈现符合题材的色调和效果，远处可见标志性元素，空气中飘浮着相应的粒子特效。前景元素：地面或前景有相关的道具或装饰，增强画面深度。光线效果：多光源混合或单一主光源，形成丰富的明暗层次和光影对比，整体色调符合题材氛围。细节质感：建筑或地貌的纹理细节，粒子特效的动态感，光影的层次感，画面层次分明（前景、中景、远景）。要有艺术字大标题"${titleText}"，标题样式要符合小说风格，字体上要有相应的视觉元素，排版要合理，要有艺术的气息。画面中只出现书名"${titleText}"这几个字，不要出现其他任何文字、符号或字母。`;
    } else {
      // 中景氛围感风格（默认）
      generatedPrompt = `超精细意境海报，8K高分辨率，极致细节刻画，电影级质感。中景氛围构图：画面展现${styleElements}的意境氛围，视角为平视或轻微俯仰，平衡人物与环境，注重意境营造。场景细节：环境与人物相得益彰，既有人物剪影或半身像，又有环境的细节展现，营造出强烈的氛围感。元素与背景：背景不完全虚化，保留一定的环境细节，天空或远景呈现符合题材的色调，空气中有相应的粒子或光效。前景与中景：人物或关键元素位于中景，前景有适当的装饰或虚化元素，增强画面层次。光线效果：柔和或戏剧性的光线，照射在人物和环境上，形成和谐的明暗关系，整体色调符合题材氛围。细节质感：人物与环境的质感细节，粒子特效的柔和扩散，光影的艺术感，画面层次分明（前景、中景人物、远景环境）。要有艺术字大标题"${titleText}"，标题样式要符合小说风格，字体上要有相应的视觉元素，排版要合理，要有艺术的气息。画面中只出现书名"${titleText}"这几个字，不要出现其他任何文字、符号或字母。`;
    }

    // 更新指令词到 settings
    onUpdate({ coverVisualPrompt: generatedPrompt });
  };

  const handleGenerateCover = async () => {
    if (!settings.title) {
      alert("请先设置小说标题");
      return;
    }

    // 检查是否有指令词
    if (!settings.coverVisualPrompt) {
      alert('请先点击"生成指令词"按钮生成指令词，或手动输入指令词');
      return;
    }

    setIsGeneratingCover(true);
    try {
      // 使用已有的指令词生成封面
      const base64Image = await generateCoverImage(settings);
      onUpdate({ coverImage: base64Image });
    } catch (e) {
      console.error(e);
      alert('封面生成失败，请检查网络或重试');
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Handle cover image upload
  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type (accept image files)
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Image = e.target?.result as string;
        onUpdate({ coverImage: base64Image });
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      alert('图片上传失败，请重试');
    } finally {
      // Reset file input
      event.target.value = '';
    }
  };

  // Handle file upload for writing style extraction
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type (accept .txt files)
    if (!file.name.endsWith('.txt')) {
      alert('请上传 .txt 格式的文本文件');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('文件大小不能超过 5MB');
      return;
    }

    setIsExtractingStyle(true);
    setUploadedFileName(file.name);

    try {
      const text = await file.text();
      const styleGuide = await extractWritingStyle(text, model);

      // Append to existing authorNote or replace
      const currentNote = settings.authorNote || '';
      const separator = currentNote ? '\n\n--- 文风参考 ---\n' : '';
      onUpdate({ authorNote: currentNote + separator + styleGuide });

      alert('文风提炼完成！已自动添加到 AI 创作指南中。');
    } catch (e) {
      console.error(e);
      alert('文风提炼失败，请检查网络或重试');
    } finally {
      setIsExtractingStyle(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Handle text/title input for style extraction
  const handleStyleExtraction = async () => {
    if (!styleInputText.trim()) {
      alert('请输入内容');
      return;
    }

    setIsExtractingStyle(true);

    try {
      let textToAnalyze = styleInputText;

      // If mode is 'title', ask AI to provide sample text based on the book title
      if (styleInputMode === 'title') {
        textToAnalyze = `请根据小说《${styleInputText}》的风格特点，生成一段该小说的典型文本样本（约500字），用于文风分析。`;
      }

      const styleGuide = await extractWritingStyle(textToAnalyze, model);

      // Append to existing authorNote
      const currentNote = settings.authorNote || '';
      const separator = currentNote ? '\n\n--- 文风参考 ---\n' : '';
      onUpdate({ authorNote: currentNote + separator + styleGuide });

      alert('文风提炼完成！已自动添加到 AI 创作指南中。');
      setStyleInputText('');
    } catch (e) {
      console.error(e);
      alert('文风提炼失败，请检查网络或重试');
    } finally {
      setIsExtractingStyle(false);
    }
  };

  // Step 1: Check Logic
  const handleCheckSync = () => {
    if (chapters.length === 0) {
      alert("归档阅览室中暂无章节，无法同步。");
      return;
    }

    // Identify last synced chapter
    const plotText = settings.currentPlotProgress || "";
    const matches = [...plotText.matchAll(/第(\d+)章/g)];
    let lastSyncedNum = 0;
    
    if (matches.length > 0) {
      const numbers = matches.map(m => parseInt(m[1], 10));
      lastSyncedNum = Math.max(...numbers);
    }

    // Find missing
    const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);
    const missingChapters = sortedChapters.filter(c => c.number > lastSyncedNum);

    if (missingChapters.length === 0) {
      alert(`当前剧情进度已是最新（检测到已包含第 ${lastSyncedNum} 章内容）。`);
      return;
    }

    // Trigger Confirmation Modal instead of alert
    setSyncConfirmData({ missingChapters, lastSyncedNum });
  };

  // Step 2: Execute Logic
  const handleExecuteSync = async () => {
    if (!syncConfirmData) return;
    const { missingChapters } = syncConfirmData;
    
    // Close confirm modal, Open progress modal
    setSyncConfirmData(null); 
    setSyncStatus('正在初始化同步进程...');
    setSyncDetailLog('准备数据包...');
    setSyncProgress(2);

    // Simulate detailed steps while waiting for API
    const steps = [
      "正在读取章节文本...",
      "正在构建上下文窗口...",
      `正在上传 ${missingChapters.length} 个章节至 Gemini 智库...`,
      "AI 正在深度阅读并分析剧情...",
      "正在提取关键剧情钩子...",
      "正在扫描新登场人物实体...",
      "正在合并世界观变动...",
      "正在生成最终同步补丁..."
    ];
    
    let stepIndex = 0;
    const intervalId = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + (Math.random() * 3);
      });
      
      // Update detailed log
      if (stepIndex < steps.length && Math.random() > 0.3) {
         setSyncDetailLog(steps[stepIndex]);
         stepIndex++;
      }
    }, 800);
    
    try {
      // API Call
      const contentToAnalyze = missingChapters.map(c => `=== 第 ${c.number} 章：${c.title} ===\n${c.content}`).join("\n\n");
      const updates = await syncPlotBatch(contentToAnalyze, settings, model);
      
      clearInterval(intervalId);
      setSyncProgress(100);
      setSyncStatus('同步完成！');
      setSyncDetailLog('正在写入本地数据库...');

      await new Promise(r => setTimeout(r, 800)); // Smooth finish
      
      onUpdate(updates);
    } catch (e) {
      console.error(e);
      clearInterval(intervalId);
      alert("同步失败，请检查网络或稍后重试。");
    } finally {
      setSyncStatus(null);
      setSyncProgress(0);
      setSyncDetailLog('');
    }
  };

  const updateField = (field: keyof NovelSettings, value: any) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden space-y-10 animate-in fade-in slide-in-from-top-4 duration-700 pb-20 relative custom-scrollbar">
      
      {/* 1. Confirmation Modal */}
      {syncConfirmData && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="relative group max-w-md w-full">
            <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/40 via-purple-600/40 to-indigo-500/40 rounded-[20px] blur-xl opacity-80 animate-pulse" />
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 border-2 border-purple-500/30 rounded-2xl p-8 shadow-[0_12px_48px_rgba(0,0,0,0.6),0_4px_16px_rgba(147,51,234,0.2)] space-y-6 animate-in zoom-in-95">
              <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />
              <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />

              <div className="flex items-center gap-4 text-purple-400">
                <div className="w-12 h-12 bg-purple-400/10 rounded-full flex items-center justify-center text-2xl">📋</div>
                <div>
                  <h3 className="font-bold text-lg text-slate-200">检测到剧情更新</h3>
                  <p className="text-xs text-purple-400/80">需要同步到沙盘</p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">当前进度</span>
                  <span className="text-slate-300">第 {syncConfirmData.lastSyncedNum} 章</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">最新归档</span>
                  <span className="text-slate-300">第 {syncConfirmData.missingChapters[syncConfirmData.missingChapters.length-1].number} 章</span>
                </div>
                <div className="h-px bg-slate-800 my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">待同步章节数</span>
                  <span className="text-xl font-bold text-green-400">{syncConfirmData.missingChapters.length} <span className="text-xs font-normal text-slate-500">章</span></span>
                </div>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed">
                系统将分析这 {syncConfirmData.missingChapters.length} 章的内容，自动提取剧情摘要并更新人物档案。
              </p>

              <div className="flex gap-3">
                <button onClick={() => setSyncConfirmData(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors">
                  暂不同步
                </button>
                <button onClick={handleExecuteSync} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-green-900/20">
                  开始同步
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Progress Modal */}
      {syncStatus && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="relative group w-full max-w-sm">
            <div className="absolute -inset-1 bg-gradient-to-br from-green-500/40 via-emerald-500/40 to-green-600/40 rounded-[20px] blur-xl opacity-80 animate-pulse" />
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 border-2 border-green-500/30 rounded-2xl p-8 shadow-[0_12px_48px_rgba(0,0,0,0.6),0_4px_16px_rgba(34,197,94,0.2)] flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />
              <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-green-400/60 to-transparent" />

              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full animate-pulse"></div>
                <div className="relative w-16 h-16 bg-slate-950 border border-green-500/30 rounded-full flex items-center justify-center text-2xl">
                  <span className="animate-spin text-3xl">🔄</span>
                </div>
              </div>

              <div className="text-center space-y-1 w-full">
                <h3 className="text-lg font-bold text-white tracking-wide">{syncStatus}</h3>
                <p className="text-xs text-slate-400 font-mono h-4 overflow-hidden">{syncDetailLog}</p>
              </div>

              <div className="w-full space-y-2">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                  <div className="h-full bg-gradient-to-r from-green-600 to-emerald-400 transition-all duration-300 ease-out relative" style={{ width: `${syncProgress}%` }}>
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono tracking-widest">
                  <span>PROCESSING</span>
                  <span>{Math.round(syncProgress)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Character Edit Modal */}
      {isCharacterModalOpen && editingCharacter && (
        <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-4xl my-8">
            {/* Outer glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-amber-500/30 via-purple-500/30 to-blue-500/30 rounded-[28px] blur-xl opacity-80" />

            {/* Main modal */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 border-2 border-amber-500/30 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-h-[85vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-purple-200 to-blue-200 bg-clip-text text-transparent">
                  {editingCharacter.index === -1 ? '添加人物' : '编辑人物'}
                </h3>
                <button
                  onClick={() => {
                    setIsCharacterModalOpen(false);
                    setEditingCharacter(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-red-500/50 border border-slate-700 hover:border-red-500 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Character form content */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-amber-400 mb-2">姓名 *</label>
                    <input
                      type="text"
                      value={editingCharacter.character.name}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, name: e.target.value }
                      })}
                      placeholder="角色姓名"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-purple-400 mb-2">身份 *</label>
                    <select
                      value={editingCharacter.character.role}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, role: e.target.value }
                      })}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    >
                      <option value="">选择身份</option>
                      <option value="男主">男主</option>
                      <option value="女主">女主</option>
                      <option value="反派">反派</option>
                      <option value="配角">配角</option>
                      <option value="龙套">龙套</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-blue-400 mb-2">角色描述 *</label>
                  <textarea
                    value={editingCharacter.character.description}
                    onChange={(e) => setEditingCharacter({
                      ...editingCharacter,
                      character: { ...editingCharacter.character, description: e.target.value }
                    })}
                    placeholder="描述角色的外貌、性格、能力等..."
                    rows={4}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                  />
                </div>

                {/* Relation to Protagonist */}
                <div>
                  <label className="block text-sm font-bold text-green-400 mb-2">与主角关系</label>
                  <input
                    type="text"
                    value={editingCharacter.character.relationToProtagonist}
                    onChange={(e) => setEditingCharacter({
                      ...editingCharacter,
                      character: { ...editingCharacter.character, relationToProtagonist: e.target.value }
                    })}
                    placeholder="例如：师父、仇人、挚友..."
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                  />
                </div>

                {/* Basic Attributes */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-cyan-400 mb-2">性别</label>
                    <input
                      type="text"
                      value={editingCharacter.character.gender || ''}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, gender: e.target.value }
                      })}
                      placeholder="男/女/未知"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-cyan-400 mb-2">年龄</label>
                    <input
                      type="text"
                      value={editingCharacter.character.age || ''}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, age: e.target.value }
                      })}
                      placeholder="例如：25岁"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-cyan-400 mb-2">性格</label>
                    <input
                      type="text"
                      value={editingCharacter.character.personality || ''}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, personality: e.target.value }
                      })}
                      placeholder="例如：冷静、热血"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Status Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-yellow-400 mb-2">当前状态</label>
                    <input
                      type="text"
                      value={editingCharacter.character.currentStatus || ''}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, currentStatus: e.target.value }
                      })}
                      placeholder="健康/受伤/昏迷"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-yellow-400 mb-2">当前所在地</label>
                    <input
                      type="text"
                      value={editingCharacter.character.currentLocation || ''}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, currentLocation: e.target.value }
                      })}
                      placeholder="例如：天剑峰/未知"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-yellow-400 mb-2">所属势力</label>
                    <input
                      type="text"
                      value={editingCharacter.character.faction || ''}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, faction: e.target.value }
                      })}
                      placeholder="例如：天剑宗"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-yellow-400 mb-2">境界等级</label>
                    <input
                      type="text"
                      value={editingCharacter.character.cultivationLevel || ''}
                      onChange={(e) => setEditingCharacter({
                        ...editingCharacter,
                        character: { ...editingCharacter.character, cultivationLevel: e.target.value }
                      })}
                      placeholder="例如：金丹期"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Relations Network - Part 1 */}
                <div className="border-t border-slate-800 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-rose-400 flex items-center gap-2">
                      <span>🔗</span>
                      人物关系网
                    </label>
                    <button
                      onClick={() => {
                        const newRelations = [...(editingCharacter.character.relations || []), {
                          characterName: '',
                          relationType: '',
                          attitude: '',
                          background: '',
                          latestInteraction: '',
                          relationStatus: ''
                        }];
                        setEditingCharacter({
                          ...editingCharacter,
                          character: { ...editingCharacter.character, relations: newRelations }
                        });
                      }}
                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold transition-all border border-rose-500/30"
                    >
                      + 添加关系
                    </button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                    {(editingCharacter.character.relations || []).map((relation, relIdx) => (
                      <div key={relIdx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-slate-500">关系 #{relIdx + 1}</span>
                          <button
                            onClick={() => {
                              const newRelations = editingCharacter.character.relations?.filter((_, i) => i !== relIdx);
                              setEditingCharacter({
                                ...editingCharacter,
                                character: { ...editingCharacter.character, relations: newRelations }
                              });
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            删除
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={relation.characterName}
                            onChange={(e) => {
                              const newRelations = editingCharacter.character.relations?.map((r, i) =>
                                i === relIdx ? { ...r, characterName: e.target.value } : r
                              );
                              setEditingCharacter({
                                ...editingCharacter,
                                character: { ...editingCharacter.character, relations: newRelations }
                              });
                            }}
                            placeholder="角色名"
                            className="bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                          />
                          <input
                            type="text"
                            value={relation.relationType}
                            onChange={(e) => {
                              const newRelations = editingCharacter.character.relations?.map((r, i) =>
                                i === relIdx ? { ...r, relationType: e.target.value } : r
                              );
                              setEditingCharacter({
                                ...editingCharacter,
                                character: { ...editingCharacter.character, relations: newRelations }
                              });
                            }}
                            placeholder="关系类型"
                            className="bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                          />
                        </div>
                        <input
                          type="text"
                          value={relation.attitude}
                          onChange={(e) => {
                            const newRelations = editingCharacter.character.relations?.map((r, i) =>
                              i === relIdx ? { ...r, attitude: e.target.value } : r
                            );
                            setEditingCharacter({
                              ...editingCharacter,
                              character: { ...editingCharacter.character, relations: newRelations }
                            });
                          }}
                          placeholder="态度"
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                        />
                        <textarea
                          value={relation.background}
                          onChange={(e) => {
                            const newRelations = editingCharacter.character.relations?.map((r, i) =>
                              i === relIdx ? { ...r, background: e.target.value } : r
                            );
                            setEditingCharacter({
                              ...editingCharacter,
                              character: { ...editingCharacter.character, relations: newRelations }
                            });
                          }}
                          placeholder="关系渊源/背景故事"
                          rows={2}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 resize-none"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={relation.latestInteraction || ''}
                            onChange={(e) => {
                              const newRelations = editingCharacter.character.relations?.map((r, i) =>
                                i === relIdx ? { ...r, latestInteraction: e.target.value } : r
                              );
                              setEditingCharacter({
                                ...editingCharacter,
                                character: { ...editingCharacter.character, relations: newRelations }
                              });
                            }}
                            placeholder="最新互动（可选）"
                            className="bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                          />
                          <input
                            type="text"
                            value={relation.relationStatus || ''}
                            onChange={(e) => {
                              const newRelations = editingCharacter.character.relations?.map((r, i) =>
                                i === relIdx ? { ...r, relationStatus: e.target.value } : r
                              );
                              setEditingCharacter({
                                ...editingCharacter,
                                character: { ...editingCharacter.character, relations: newRelations }
                              });
                            }}
                            placeholder="关系状态（可选）"
                            className="bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Items/Pets Section */}
                <div className="border-t border-slate-800 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-purple-400 flex items-center gap-2">
                      <span>🎒</span>
                      道具 / 灵宠
                    </label>
                    <button
                      onClick={() => {
                        const newItems = [...(editingCharacter.character.items || []), {
                          name: '',
                          description: ''
                        }];
                        setEditingCharacter({
                          ...editingCharacter,
                          character: { ...editingCharacter.character, items: newItems }
                        });
                      }}
                      className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold transition-all border border-purple-500/30"
                    >
                      + 添加道具/灵宠
                    </button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                    {(editingCharacter.character.items || []).map((item, itemIdx) => (
                      <div key={itemIdx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-slate-500">道具/灵宠 #{itemIdx + 1}</span>
                          <button
                            onClick={() => {
                              const newItems = editingCharacter.character.items?.filter((_, i) => i !== itemIdx);
                              setEditingCharacter({
                                ...editingCharacter,
                                character: { ...editingCharacter.character, items: newItems }
                              });
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            删除
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = editingCharacter.character.items?.map((it, i) =>
                              i === itemIdx ? { ...it, name: e.target.value } : it
                            );
                            setEditingCharacter({
                              ...editingCharacter,
                              character: { ...editingCharacter.character, items: newItems }
                            });
                          }}
                          placeholder="道具/灵宠名称"
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                        />
                        <textarea
                          value={item.description}
                          onChange={(e) => {
                            const newItems = editingCharacter.character.items?.map((it, i) =>
                              i === itemIdx ? { ...it, description: e.target.value } : it
                            );
                            setEditingCharacter({
                              ...editingCharacter,
                              character: { ...editingCharacter.character, items: newItems }
                            });
                          }}
                          placeholder="能力描述"
                          rows={3}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills Section */}
                <div className="border-t border-slate-800 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-blue-400 flex items-center gap-2">
                      <span>⚔️</span>
                      技能
                    </label>
                    <button
                      onClick={() => {
                        const newSkills = [...(editingCharacter.character.skills || []), {
                          name: '',
                          description: ''
                        }];
                        setEditingCharacter({
                          ...editingCharacter,
                          character: { ...editingCharacter.character, skills: newSkills }
                        });
                      }}
                      className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs font-semibold transition-all border border-blue-500/30"
                    >
                      + 添加技能
                    </button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                    {(editingCharacter.character.skills || []).map((skill, skillIdx) => (
                      <div key={skillIdx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-slate-500">技能 #{skillIdx + 1}</span>
                          <button
                            onClick={() => {
                              const newSkills = editingCharacter.character.skills?.filter((_, i) => i !== skillIdx);
                              setEditingCharacter({
                                ...editingCharacter,
                                character: { ...editingCharacter.character, skills: newSkills }
                              });
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            删除
                          </button>
                        </div>
                        <input
                          type="text"
                          value={skill.name}
                          onChange={(e) => {
                            const newSkills = editingCharacter.character.skills?.map((sk, i) =>
                              i === skillIdx ? { ...sk, name: e.target.value } : sk
                            );
                            setEditingCharacter({
                              ...editingCharacter,
                              character: { ...editingCharacter.character, skills: newSkills }
                            });
                          }}
                          placeholder="技能名称"
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                        <textarea
                          value={skill.description}
                          onChange={(e) => {
                            const newSkills = editingCharacter.character.skills?.map((sk, i) =>
                              i === skillIdx ? { ...sk, description: e.target.value } : sk
                            );
                            setEditingCharacter({
                              ...editingCharacter,
                              character: { ...editingCharacter.character, skills: newSkills }
                            });
                          }}
                          placeholder="技能详细能力描述"
                          rows={3}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={() => {
                    setIsCharacterModalOpen(false);
                    setEditingCharacter(null);
                  }}
                  className="flex-1 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl font-semibold transition-all border border-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (editingCharacter.index === -1) {
                      // Add new character
                      updateField('characters', [...settings.characters, editingCharacter.character]);
                    } else {
                      // Update existing character
                      const newChars = settings.characters.map((c, i) =>
                        i === editingCharacter.index ? editingCharacter.character : c
                      );
                      updateField('characters', newChars);
                    }
                    setIsCharacterModalOpen(false);
                    setEditingCharacter(null);
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 hover:from-amber-400 hover:via-purple-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Faction Edit Modal */}
      {isFactionModalOpen && editingFaction && (
        <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8">
            {/* Outer glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-red-500/30 via-orange-500/30 to-yellow-500/30 rounded-[28px] blur-xl opacity-80" />

            {/* Main modal */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 border-2 border-red-500/30 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-h-[85vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-red-200 via-orange-200 to-yellow-200 bg-clip-text text-transparent">
                  {editingFaction.index === -1 ? '添加势力' : '编辑势力'}
                </h3>
                <button
                  onClick={() => {
                    setIsFactionModalOpen(false);
                    setEditingFaction(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-red-500/50 border border-slate-700 hover:border-red-500 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Faction form content */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-red-400 mb-2">势力名称 *</label>
                    <input
                      type="text"
                      value={editingFaction.faction.name}
                      onChange={(e) => setEditingFaction({
                        ...editingFaction,
                        faction: { ...editingFaction.faction, name: e.target.value }
                      })}
                      placeholder="势力名称"
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-orange-400 mb-2">所属地域</label>
                    <input
                      type="text"
                      value={editingFaction.faction.territory}
                      onChange={(e) => setEditingFaction({
                        ...editingFaction,
                        faction: { ...editingFaction.faction, territory: e.target.value }
                      })}
                      placeholder="例如：东域、北境..."
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-yellow-400 mb-2">势力描述 *</label>
                  <textarea
                    value={editingFaction.faction.description}
                    onChange={(e) => setEditingFaction({
                      ...editingFaction,
                      faction: { ...editingFaction.faction, description: e.target.value }
                    })}
                    placeholder="描述势力的背景、实力、特点等..."
                    rows={4}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all resize-none"
                  />
                </div>

                {/* Members */}
                <div className="border-t border-slate-800 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-green-400 flex items-center gap-2">
                      <span>👥</span>
                      势力人物
                    </label>
                    <button
                      onClick={() => {
                        const newMembers = [...(editingFaction.faction.members || []), ''];
                        setEditingFaction({
                          ...editingFaction,
                          faction: { ...editingFaction.faction, members: newMembers }
                        });
                      }}
                      className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-xs font-semibold transition-all border border-green-500/30"
                    >
                      + 添加人物
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {(editingFaction.faction.members || []).map((member, memberIdx) => (
                      <div key={memberIdx} className="flex gap-2">
                        <input
                          type="text"
                          value={member}
                          onChange={(e) => {
                            const newMembers = editingFaction.faction.members?.map((m, i) =>
                              i === memberIdx ? e.target.value : m
                            );
                            setEditingFaction({
                              ...editingFaction,
                              faction: { ...editingFaction.faction, members: newMembers }
                            });
                          }}
                          placeholder="角色名称"
                          className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500/50"
                        />
                        <button
                          onClick={() => {
                            const newMembers = editingFaction.faction.members?.filter((_, i) => i !== memberIdx);
                            setEditingFaction({
                              ...editingFaction,
                              faction: { ...editingFaction.faction, members: newMembers }
                            });
                          }}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs transition-all"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={() => {
                    setIsFactionModalOpen(false);
                    setEditingFaction(null);
                  }}
                  className="flex-1 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl font-semibold transition-all border border-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (editingFaction.index === -1) {
                      // Add new faction
                      updateField('factions', [...(settings.factions || []), editingFaction.faction]);
                    } else {
                      // Update existing faction
                      const newFactions = (settings.factions || []).map((f, i) =>
                        i === editingFaction.index ? editingFaction.faction : f
                      );
                      updateField('factions', newFactions);
                    }
                    setIsFactionModalOpen(false);
                    setEditingFaction(null);
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-red-500 via-orange-600 to-yellow-600 hover:from-red-400 hover:via-orange-500 hover:to-yellow-500 text-white rounded-xl font-semibold transition-all shadow-lg"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Edit Modal */}
      {isLocationModalOpen && editingLocation && (
        <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8">
            {/* Outer glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/30 via-cyan-500/30 to-teal-500/30 rounded-[28px] blur-xl opacity-80" />

            {/* Main modal */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 border-2 border-blue-500/30 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-h-[85vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-200 via-cyan-200 to-teal-200 bg-clip-text text-transparent">
                  {editingLocation.index === -1 ? '添加地点' : '编辑地点'}
                </h3>
                <button
                  onClick={() => {
                    setIsLocationModalOpen(false);
                    setEditingLocation(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-blue-500/50 border border-slate-700 hover:border-blue-500 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Location form content */}
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-bold text-blue-400 mb-2">地点名称 *</label>
                  <input
                    type="text"
                    value={editingLocation.location.name}
                    onChange={(e) => setEditingLocation({
                      ...editingLocation,
                      location: { ...editingLocation.location, name: e.target.value }
                    })}
                    placeholder="地点名称"
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-cyan-400 mb-2">地点描述 *</label>
                  <textarea
                    value={editingLocation.location.description}
                    onChange={(e) => setEditingLocation({
                      ...editingLocation,
                      location: { ...editingLocation.location, description: e.target.value }
                    })}
                    placeholder="描述地点的地理特征、环境、氛围等..."
                    rows={4}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                  />
                </div>

                {/* Factions */}
                <div className="border-t border-slate-800 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-teal-400 flex items-center gap-2">
                      <span>⚔️</span>
                      归属势力
                    </label>
                    <button
                      onClick={() => {
                        const newFactions = [...(editingLocation.location.factions || []), ''];
                        setEditingLocation({
                          ...editingLocation,
                          location: { ...editingLocation.location, factions: newFactions }
                        });
                      }}
                      className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg text-xs font-semibold transition-all border border-teal-500/30"
                    >
                      + 添加势力
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {(editingLocation.location.factions || []).map((faction, factionIdx) => (
                      <div key={factionIdx} className="flex gap-2">
                        <input
                          type="text"
                          value={faction}
                          onChange={(e) => {
                            const newFactions = editingLocation.location.factions?.map((f, i) =>
                              i === factionIdx ? e.target.value : f
                            );
                            setEditingLocation({
                              ...editingLocation,
                              location: { ...editingLocation.location, factions: newFactions }
                            });
                          }}
                          placeholder="势力名称"
                          className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                        />
                        <button
                          onClick={() => {
                            const newFactions = editingLocation.location.factions?.filter((_, i) => i !== factionIdx);
                            setEditingLocation({
                              ...editingLocation,
                              location: { ...editingLocation.location, factions: newFactions }
                            });
                          }}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs transition-all"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={() => {
                    setIsLocationModalOpen(false);
                    setEditingLocation(null);
                  }}
                  className="flex-1 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl font-semibold transition-all border border-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (editingLocation.index === -1) {
                      // Add new location
                      updateField('locations', [...(settings.locations || []), editingLocation.location]);
                    } else {
                      // Update existing location
                      const newLocations = (settings.locations || []).map((l, i) =>
                        i === editingLocation.index ? editingLocation.location : l
                      );
                      updateField('locations', newLocations);
                    }
                    setIsLocationModalOpen(false);
                    setEditingLocation(null);
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 via-cyan-600 to-teal-600 hover:from-blue-400 hover:via-cyan-500 hover:to-teal-500 text-white rounded-xl font-semibold transition-all shadow-lg"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Creative Generator - Hero Section */}
      <section className="group relative">
        {/* Outer glow layer - creates depth */}
        <div className="absolute -inset-1 bg-gradient-to-br from-amber-500/20 via-purple-500/20 to-blue-500/20 rounded-[28px] blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

        {/* Main container with enhanced 3D effect */}
        <div className="relative backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 border-2 border-amber-500/30 rounded-3xl p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(251,191,36,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.5),0_4px_16px_rgba(251,191,36,0.2)] transition-all duration-500 overflow-hidden">

          {/* Inner border highlight for 3D effect */}
          <div className="absolute inset-0 rounded-3xl border border-white/5 pointer-events-none" />

          {/* Top edge highlight */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          {/* Ambient glow effect */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-amber-500/15 via-purple-500/15 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-blue-500/15 via-purple-500/15 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <div className="relative z-10 space-y-6">
          <div>
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <span className="bg-gradient-to-r from-amber-200 via-purple-200 to-blue-200 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(251,191,36,0.3)]">灵感火花</span>
              <span className="text-xs font-bold bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30 shadow-lg backdrop-blur-sm tracking-widest uppercase">AI Engine</span>
            </h3>
            <p className="text-slate-400 mb-6 text-sm md:text-base leading-relaxed">
              只需提供一个核心点子，AI将为您构建完整的世界雏形、力量体系及核心冲突。
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="例如：'赛博朋克背景下的修仙者...'"
                rows={3}
                className="flex-1 bg-slate-950/60 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all shadow-inner resize-none"
              />
              <button
                onClick={handleAIGenerate}
                className="group relative overflow-hidden px-8 py-3.5 rounded-2xl font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap"
              >
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-[length:200%_100%] animate-[gradient_3s_ease_infinite]" />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-0 bg-purple-400/30 blur-xl" />
                </div>

                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>

                {/* Text with icon */}
                <span className="relative flex items-center gap-2 text-white">
                  <span className="text-lg">✨</span>
                  <span>构建世界观</span>
                </span>
              </button>
            </div>
          </div>

          {/* 小说类型与目标配置 - 嵌入到灵感火花内部 */}
          <div className="pt-6 border-t border-slate-700/50">
            <div className="space-y-5">
              {/* 小说类型选择 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">小说类型与目标</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => updateField('novelType', 'long')}
                    className={`group relative flex-1 px-5 py-3.5 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                      (settings.novelType || 'long') === 'long'
                        ? 'border-amber-500/60 shadow-xl shadow-amber-500/20'
                        : 'border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    {(settings.novelType || 'long') === 'long' ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-blue-600/20" />
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 blur-xl" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-slate-950/40" />
                    )}
                    <span className={`relative font-bold ${
                      (settings.novelType || 'long') === 'long'
                        ? 'bg-gradient-to-r from-amber-200 to-purple-200 bg-clip-text text-transparent'
                        : 'text-slate-400'
                    }`}>
                      📚 长篇小说
                    </span>
                  </button>
                  <button
                    onClick={() => updateField('novelType', 'short')}
                    className={`group relative flex-1 px-5 py-3.5 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                      settings.novelType === 'short'
                        ? 'border-amber-500/60 shadow-xl shadow-amber-500/20'
                        : 'border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    {settings.novelType === 'short' ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-blue-600/20" />
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 blur-xl" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-slate-950/40" />
                    )}
                    <span className={`relative font-bold ${
                      settings.novelType === 'short'
                        ? 'bg-gradient-to-r from-amber-200 to-purple-200 bg-clip-text text-transparent'
                        : 'text-slate-400'
                    }`}>
                      📖 短篇小说
                    </span>
                  </button>
                </div>
              </div>

              {/* 目标配置 */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold bg-gradient-to-r from-amber-400/60 to-purple-400/60 bg-clip-text text-transparent uppercase tracking-wider mb-2">目标总字数</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.targetTotalWords || ''}
                      onChange={(e) => updateField('targetTotalWords', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder={settings.novelType === 'short' ? "例如：30000" : "例如：1000000"}
                      min="5000"
                      max="10000000"
                      className="w-full backdrop-blur-sm bg-slate-950/60 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all shadow-inner"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">字</div>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold bg-gradient-to-r from-purple-400/60 to-blue-400/60 bg-clip-text text-transparent uppercase tracking-wider mb-2">目标章节数</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.targetChapterCount || ''}
                      onChange={(e) => updateField('targetChapterCount', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder={settings.novelType === 'short' ? "例如：10" : "例如：300"}
                      min="3"
                      max="10000"
                      className="w-full backdrop-blur-sm bg-slate-950/60 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50 transition-all shadow-inner"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">章</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 italic">
                {settings.novelType === 'short'
                  ? '💡 短篇模式：AI 会根据目标字数和章节数自动规划剧情节奏，在最后一章自动收尾'
                  : '💡 长篇模式：设置目标可帮助 AI 更好地规划剧情节奏和章节安排'}
              </p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column: Core Identity & Narrative */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section: Basic Identity with Cover Image */}
          <Card icon="🔖" title="身份标识与封面">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Left: Inputs */}
              <div className="flex-1 space-y-5">
                <InputField label="作品书名" value={settings.title} onChange={(v) => updateField('title', v)} placeholder="输入书名..." />
                <InputField label="小说风格" value={settings.style} onChange={(v) => updateField('style', v)} placeholder="玄幻、科幻、同人..." />

                <div>
                  <label className="block text-xs font-bold bg-gradient-to-r from-amber-400/80 to-purple-400/80 bg-clip-text text-transparent uppercase tracking-wider mb-3 ml-1">核心标签</label>

                  {/* Tag chips display */}
                  <div className="flex flex-wrap gap-2">
                    {settings.tags.filter(t => t.trim()).map((tag, idx) => (
                      <span
                        key={idx}
                        className="group relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20 border border-amber-500/40 rounded-full text-sm font-semibold text-amber-200 shadow-lg backdrop-blur-sm hover:shadow-amber-500/20 transition-all"
                      >
                        <span className="relative z-10">{tag}</span>
                        <button
                          onClick={() => {
                            const newTags = settings.tags.filter((_, i) => i !== idx);
                            updateField('tags', newTags);
                          }}
                          className="relative z-10 w-4 h-4 rounded-full bg-slate-900/50 hover:bg-red-500/50 flex items-center justify-center text-slate-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-purple-500/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    ))}

                    {/* Add Tag Button */}
                    {!showTagInput ? (
                      <button
                        onClick={() => setShowTagInput(true)}
                        className="group relative inline-flex items-center gap-2 px-4 py-2 bg-slate-950/60 border-2 border-dashed border-amber-500/30 hover:border-amber-500/60 rounded-full text-sm font-semibold text-slate-400 hover:text-amber-300 backdrop-blur-sm transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>添加标签</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTagInput.trim()) {
                              updateField('tags', [...settings.tags, newTagInput.trim()]);
                              setNewTagInput('');
                              setShowTagInput(false);
                            } else if (e.key === 'Escape') {
                              setNewTagInput('');
                              setShowTagInput(false);
                            }
                          }}
                          placeholder="输入标签名..."
                          autoFocus
                          className="w-32 px-3 py-2 bg-slate-950/60 border border-amber-500/40 rounded-full text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all"
                        />
                        <button
                          onClick={() => {
                            if (newTagInput.trim()) {
                              updateField('tags', [...settings.tags, newTagInput.trim()]);
                              setNewTagInput('');
                            }
                            setShowTagInput(false);
                          }}
                          className="w-8 h-8 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center justify-center text-amber-300 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setNewTagInput('');
                            setShowTagInput(false);
                          }}
                          className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-slate-300 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Cover Image Area */}
              <div className="w-full sm:w-48 flex flex-col gap-3 shrink-0">
                <div className="relative group">
                  {/* Outer glow */}
                  <div className="absolute -inset-1 bg-gradient-to-br from-amber-500/30 via-purple-500/30 to-blue-500/30 rounded-[20px] blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Main cover container with 3D effect */}
                  <div className="relative aspect-[3/4] rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/40 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.4),0_2px_8px_rgba(251,191,36,0.15),inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5),0_4px_12px_rgba(251,191,36,0.25)] transition-all duration-500">

                     {/* Inner border highlight */}
                     <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none z-10" />

                     {/* Decorative corner accents with glow */}
                     <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-400/70 rounded-tl-2xl shadow-[0_0_12px_rgba(251,191,36,0.4)]" />
                     <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-purple-400/70 rounded-tr-2xl shadow-[0_0_12px_rgba(147,51,234,0.4)]" />
                     <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-purple-400/70 rounded-bl-2xl shadow-[0_0_12px_rgba(147,51,234,0.4)]" />
                     <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400/70 rounded-br-2xl shadow-[0_0_12px_rgba(59,130,246,0.4)]" />

                   {settings.coverImage ? (
                     <>
                       <img src={settings.coverImage} alt="Book Cover" className="w-full h-full object-cover" />
                       {/* Hover overlay */}
                       <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                         <span className="text-xs text-amber-300 font-semibold">点击下方按钮更换</span>
                       </div>
                     </>
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                       <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                         <span className="text-3xl">🖼️</span>
                       </div>
                       <span className="text-xs text-slate-500 font-medium">暂无封面</span>
                       <span className="text-[10px] text-slate-600 mt-1">点击下方生成</span>
                     </div>
                   )}
                   {isGeneratingCover && (
                     <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                       <div className="relative">
                         <div className="absolute inset-0 bg-purple-500/30 blur-xl rounded-full animate-pulse" />
                         <div className="relative animate-spin rounded-full h-10 w-10 border-3 border-purple-500 border-t-transparent"></div>
                       </div>
                       <span className="text-xs text-purple-300 font-semibold">AI 绘制中...</span>
                     </div>
                   )}
                </div>
                </div>
                <button
                  onClick={handleGenerateCover}
                  disabled={isGeneratingCover}
                  className="group relative w-full py-3 bg-gradient-to-r from-purple-600/20 via-purple-500/20 to-indigo-600/20 hover:from-purple-600/30 hover:via-purple-500/30 hover:to-indigo-600/30 text-sm font-bold text-purple-200 border border-purple-500/40 hover:border-purple-400/60 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/20 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-400/10 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <span className="relative flex items-center justify-center gap-2">
                    <span>🎨</span>
                    {isGeneratingCover ? '绘制中...' : 'AI 生成封面'}
                  </span>
                </button>
                <label className="group relative w-full py-3 bg-gradient-to-r from-blue-600/20 via-blue-500/20 to-cyan-600/20 hover:from-blue-600/30 hover:via-blue-500/30 hover:to-cyan-600/30 text-sm font-bold text-blue-200 border border-blue-500/40 hover:border-blue-400/60 rounded-xl transition-all cursor-pointer text-center shadow-lg hover:shadow-blue-500/20 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-400/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <span className="relative flex items-center justify-center gap-2">
                    <span>📁</span>
                    本地上传封面
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            
            {/* Visual Prompt Editor (Collapsible style) */}
            <div className="mt-6 pt-4 border-t border-slate-800/50">
               <div className="flex justify-between items-center mb-3 ml-1">
                 <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">封面生图指令词 (中文)</label>
                 <button
                   onClick={handleGeneratePrompt}
                   disabled={!settings.title}
                   className="text-[10px] px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   ✨ 生成指令词
                 </button>
               </div>

               {/* Composition Style Selector */}
               <div className="mb-3">
                 <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">构图风格</label>
                 <div className="flex gap-2">
                   <button
                     onClick={() => setCoverCompositionStyle('close-up')}
                     className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                       coverCompositionStyle === 'close-up'
                         ? 'bg-gradient-to-r from-amber-500/30 to-purple-500/30 text-amber-200 border-2 border-amber-500/50 shadow-lg shadow-amber-500/20'
                         : 'bg-slate-950/40 text-slate-500 border border-slate-800/50 hover:border-slate-700'
                     }`}
                   >
                     👤 角色特写
                   </button>
                   <button
                     onClick={() => setCoverCompositionStyle('mid-atmosphere')}
                     className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                       coverCompositionStyle === 'mid-atmosphere'
                         ? 'bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-purple-200 border-2 border-purple-500/50 shadow-lg shadow-purple-500/20'
                         : 'bg-slate-950/40 text-slate-500 border border-slate-800/50 hover:border-slate-700'
                     }`}
                   >
                     🎭 中景氛围感
                   </button>
                   <button
                     onClick={() => setCoverCompositionStyle('wide-scene')}
                     className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                       coverCompositionStyle === 'wide-scene'
                         ? 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30 text-blue-200 border-2 border-blue-500/50 shadow-lg shadow-blue-500/20'
                         : 'bg-slate-950/40 text-slate-500 border border-slate-800/50 hover:border-slate-700'
                     }`}
                   >
                     🏔️ 宏大场景
                   </button>
                 </div>
               </div>

               <textarea
                 value={settings.coverVisualPrompt || ''}
                 onChange={(e) => updateField('coverVisualPrompt', e.target.value)}
                 rows={3}
                 placeholder='选择构图风格后，点击"生成指令词"按钮，AI会根据小说设定生成中文指令词。您可以查看和修改后，再点击"AI生成封面"...'
                 className="w-full bg-slate-950/20 border border-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-purple-500/30 resize-y"
               />
            </div>
          </Card>

          {/* Section: Writing Style Guide (NEW) */}
          <Card icon="🎭" title="文风与笔调 (AI 设定)">
            <div className="space-y-4">
              <TextAreaField
                  label="AI 创作/扮演指南"
                  value={settings.authorNote || ''}
                  onChange={(v) => updateField('authorNote', v)}
                  rows={9}
                  placeholder="例如：请使用暗黑流风格，主角杀伐果断；多用短句，减少心理描写，注重动作和画面感..."
                  badge="影响所有AI生成"
                />

              {/* Style Extraction Section */}
              <div className="pt-4 border-t border-slate-800/50">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">
                  📚 文风提炼
                </label>

                {/* Mode Selection Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setStyleInputMode('file')}
                    className={`group relative flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all overflow-hidden ${
                      styleInputMode === 'file'
                        ? 'text-white shadow-lg'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {styleInputMode === 'file' ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600" />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-purple-400 to-indigo-500 blur-lg opacity-50" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-slate-900/60 border border-slate-700/50" />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      <span>📄</span>
                      上传文件
                    </span>
                  </button>
                  <button
                    onClick={() => setStyleInputMode('text')}
                    className={`group relative flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all overflow-hidden ${
                      styleInputMode === 'text'
                        ? 'text-white shadow-lg'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {styleInputMode === 'text' ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600" />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-purple-400 to-indigo-500 blur-lg opacity-50" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-slate-900/60 border border-slate-700/50" />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      <span>✍️</span>
                      粘贴文本
                    </span>
                  </button>
                  <button
                    onClick={() => setStyleInputMode('title')}
                    className={`group relative flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all overflow-hidden ${
                      styleInputMode === 'title'
                        ? 'text-white shadow-lg'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {styleInputMode === 'title' ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600" />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-purple-400 to-indigo-500 blur-lg opacity-50" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-slate-900/60 border border-slate-700/50" />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      <span>📖</span>
                      输入书名
                    </span>
                  </button>
                </div>

                {/* File Upload Mode */}
                {styleInputMode === 'file' && (
                  <div className="space-y-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept=".txt"
                        onChange={handleFileUpload}
                        disabled={isExtractingStyle}
                        className="hidden"
                      />
                      <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all ${
                        isExtractingStyle
                          ? 'bg-purple-500/5 border-purple-500/30 cursor-not-allowed'
                          : 'bg-slate-950/40 border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5'
                      }`}>
                        {isExtractingStyle ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                            <span className="text-sm text-purple-400">正在分析文风...</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">📄</span>
                            <span className="text-sm text-slate-400">点击上传 .txt 文件</span>
                          </>
                        )}
                      </div>
                    </label>
                    <p className="text-xs text-slate-600 ml-1">
                      💡 上传参考小说（.txt 格式，最大 5MB）
                    </p>
                  </div>
                )}

                {/* Text Input Mode */}
                {styleInputMode === 'text' && (
                  <div className="space-y-2">
                    <textarea
                      value={styleInputText}
                      onChange={(e) => setStyleInputText(e.target.value)}
                      placeholder="粘贴小说原文片段（建议 500-2000 字）..."
                      rows={6}
                      disabled={isExtractingStyle}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-y"
                    />
                    <button
                      onClick={handleStyleExtraction}
                      disabled={isExtractingStyle || !styleInputText.trim()}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isExtractingStyle ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>正在分析...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>开始提炼文风</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Title Input Mode */}
                {styleInputMode === 'title' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={styleInputText}
                      onChange={(e) => setStyleInputText(e.target.value)}
                      placeholder="输入热门小说书名，如：《斗破苍穹》、《诡秘之主》..."
                      disabled={isExtractingStyle}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    />
                    <button
                      onClick={handleStyleExtraction}
                      disabled={isExtractingStyle || !styleInputText.trim()}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isExtractingStyle ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>正在分析...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>开始提炼文风</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-600 ml-1">
                      💡 AI 将根据书名分析该小说的典型文风特征
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: World Rules & Core Concept */}
        <div className="lg:col-span-5 space-y-6">

          {/* Section: Core Concept */}
          <Card icon="🔮" title="核心卖点">
            <div className="space-y-6">
              <TextAreaField
                label="金手指 / 核心设定"
                value={settings.goldFinger}
                onChange={(v) => updateField('goldFinger', v)}
                rows={3}
                placeholder="描述主角最核心的特殊能力或系统..."
              />
              <TextAreaField
                label="内容简介"
                value={settings.synopsis}
                onChange={(v) => updateField('synopsis', v)}
                rows={6}
                placeholder="吸引读者的故事主线摘要..."
                className="serif-font"
              />
            </div>
          </Card>

          {/* Section: World Rules */}
          <Card icon="🗺️" title="世界法则 (动态演化)">
            <div className="space-y-6">
              <TextAreaField
                label="升级 / 战力体系"
                value={settings.levelingSystem}
                onChange={(v) => updateField('levelingSystem', v)}
                rows={6}
                badge="AUTO-UPDATE"
                placeholder="练气、筑基、金丹... 或其它独特的等级划分"
              />
              <TextAreaField
                label="世界地理与背景"
                value={settings.background}
                onChange={(v) => updateField('background', v)}
                rows={6}
                badge="AUTO-UPDATE"
                placeholder="地理环境、势力分布、历史底蕴..."
              />
              <TextAreaField
                label="世界规律法则"
                value={settings.worldRules || ''}
                onChange={(v) => updateField('worldRules', v)}
                rows={6}
                badge="AUTO-UPDATE"
                placeholder="出行方式（飞行法宝、传送阵）、金钱体系（灵石、金币）、社会制度、交易规则、通讯方式等..."
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Full Width Section: Plot Sandbox */}
      <div className="mt-6">
        {/* Section: Progress Tracking */}
        <Card icon="📈" title="剧情沙盘 (自动追加)" action={
          <button
             onClick={handleCheckSync}
             disabled={!!syncStatus}
             className="group relative flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-600/20 border border-green-500/30 hover:border-green-400/50 text-green-300 hover:text-white transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/20 overflow-hidden"
          >
             <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-400/20 to-green-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
             <span className="relative text-base">🔄</span>
             <span className="relative">检测并同步</span>
          </button>
        }
        >
          <TextAreaField
            label="当前剧情阶段"
            value={settings.currentPlotProgress}
            onChange={(v) => updateField('currentPlotProgress', v)}
            rows={8}
            badge="AUTO-SYNC"
            placeholder="目前主角正在做什么？处于哪个小高潮？（本区域会随章节归档自动追加最新进展）"
          />
        </Card>
      </div>

      {/* Full Width Section: Characters Gallery */}
      <div className="mt-6">
        {/* Section: Characters */}
        <Card icon="👥" title="人物档案 (动态更新)" action={
              <button
                onClick={() => {
                  setEditingCharacter({
                    index: -1,
                    character: { name: '', role: '', description: '', relationToProtagonist: '', relations: [], items: [], skills: [] }
                  });
                  setIsCharacterModalOpen(true);
                }}
                className="group relative flex items-center gap-2 text-xs bg-gradient-to-r from-purple-500/20 via-purple-600/20 to-indigo-500/20 text-purple-200 hover:text-white px-4 py-2 rounded-xl border border-purple-500/30 hover:border-purple-400/50 transition-all shadow-lg hover:shadow-purple-500/20 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-400/20 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative text-lg">+</span>
                <span className="relative font-bold">手动添加</span>
              </button>
          }
          >
            {settings.characters.length === 0 ? (
              <div className="relative text-center py-16 text-slate-500 text-sm border-2 border-dashed border-amber-500/20 rounded-2xl bg-gradient-to-br from-amber-500/5 via-purple-500/5 to-blue-500/5 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-4 right-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
                <div className="absolute bottom-4 left-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 via-purple-500/20 to-blue-500/20 border border-amber-500/30 flex items-center justify-center">
                    <span className="text-3xl">👥</span>
                  </div>
                  <p className="font-semibold text-slate-400">暂无登场人物</p>
                  <p className="text-xs text-slate-600 mt-2">随章节创作自动添加</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-6 h-[700px]">
                {/* Left: Character List */}
                <div className="w-64 flex flex-col">
                  {/* Search Bar */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={characterSearchQuery}
                        onChange={(e) => setCharacterSearchQuery(e.target.value)}
                        placeholder="搜索角色名称..."
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Character Chips */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {settings.characters
                      .map((char, idx) => ({ char, idx }))
                      .filter(({ char }) =>
                        !characterSearchQuery ||
                        char.name.toLowerCase().includes(characterSearchQuery.toLowerCase()) ||
                        char.role.toLowerCase().includes(characterSearchQuery.toLowerCase())
                      )
                      .map(({ char, idx }) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedCharacterIndex(idx)}
                          className={`w-full text-left p-3 rounded-xl transition-all ${
                            selectedCharacterIndex === idx
                              ? 'bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20 border-2 border-amber-500/50 shadow-lg'
                              : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg ${
                              selectedCharacterIndex === idx
                                ? 'bg-gradient-to-br from-amber-500/30 to-purple-500/30 border-2 border-amber-400/50'
                                : 'bg-slate-800/50 border border-slate-700'
                            }`}>
                              {char.avatar ? (
                                <img
                                  src={char.avatar}
                                  alt={char.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>
                                  {char.role === '男主' ? '👨' : char.role === '女主' ? '👩' : char.role === '反派' ? '😈' : '👤'}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-bold text-sm truncate ${
                                selectedCharacterIndex === idx ? 'text-amber-200' : 'text-slate-300'
                              }`}>
                                {char.name || '未命名'}
                              </div>
                              <div className={`text-xs truncate ${
                                selectedCharacterIndex === idx ? 'text-purple-300' : 'text-slate-500'
                              }`}>
                                {char.role || '未设置身份'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Right: Character Detail */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {(() => {
                    const char = (settings.characters || [])[selectedCharacterIndex];
                    if (!char) return null;

                    return (
                      <div className="space-y-4">
                        {/* Header with Avatar and Actions */}
                        <div className="flex justify-between items-start gap-6">
                          <div className="flex gap-6 flex-1">
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                              <button
                                onClick={() => openAvatarSelector(selectedCharacterIndex)}
                                className="group/avatar relative block"
                                title="点击更换头像"
                              >
                                {/* Outer glow effect */}
                                <div className="absolute -inset-2 bg-gradient-to-br from-amber-500/30 via-purple-500/30 to-blue-500/30 rounded-3xl blur-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />

                                {/* Main avatar container with 3D effect */}
                                <div className="relative">
                                  {/* Inner shadow for depth */}
                                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-black/40 to-transparent" />

                                  {char.avatar ? (
                                    <img
                                      src={char.avatar}
                                      alt={char.name}
                                      className="relative w-48 h-48 rounded-2xl object-cover border-4 border-amber-500/40 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_2px_8px_rgba(251,191,36,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] group-hover/avatar:border-amber-400/70 group-hover/avatar:shadow-[0_12px_48px_rgba(0,0,0,0.7),0_4px_16px_rgba(251,191,36,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-300"
                                    />
                                  ) : (
                                    <div className="relative w-48 h-48 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 border-4 border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] group-hover/avatar:border-amber-500/60 group-hover/avatar:shadow-[0_12px_48px_rgba(0,0,0,0.7),0_4px_16px_rgba(251,191,36,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center justify-center text-7xl transition-all duration-300">
                                      {char.role === '男主' ? '👨' : char.role === '女主' ? '👩' : char.role === '反派' ? '😈' : '👤'}
                                    </div>
                                  )}

                                  {/* Top edge highlight for 3D effect */}
                                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />

                                  {/* Bottom shadow for elevation */}
                                  <div className="absolute -bottom-2 left-1/4 right-1/4 h-4 bg-black/40 blur-xl rounded-full" />
                                </div>

                                {/* Hover overlay with icon */}
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-black/70 via-black/60 to-black/70 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                                  <div className="text-white text-center transform scale-90 group-hover/avatar:scale-100 transition-transform duration-300">
                                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-amber-500/30 to-purple-500/30 border-2 border-amber-400/50 flex items-center justify-center shadow-lg">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div className="text-sm font-semibold bg-gradient-to-r from-amber-200 to-purple-200 bg-clip-text text-transparent">
                                      更换头像
                                    </div>
                                  </div>
                                </div>
                              </button>
                            </div>

                            {/* Name and Tags */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-purple-200 to-blue-200 bg-clip-text text-transparent mb-3">
                                {char.name || '未命名角色'}
                              </h3>

                              {/* Organized Tag Groups */}
                              <div className="space-y-2">
                              {/* Row 1: Role & Relationship */}
                              <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-sm font-semibold">
                                  {char.role || '未设置'}
                                </span>
                                {char.relationToProtagonist && (
                                  <span className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 text-sm">
                                    {char.relationToProtagonist}
                                  </span>
                                )}
                              </div>

                              {/* Row 2: Basic Info */}
                              {(char.gender || char.age || char.personality) && (
                                <div className="flex flex-wrap gap-2">
                                  {char.gender && (
                                    <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-sm">
                                      {char.gender}
                                    </span>
                                  )}
                                  {char.age && (
                                    <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-sm">
                                      {char.age}
                                    </span>
                                  )}
                                  {char.personality && (
                                    <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-sm">
                                      {char.personality}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Row 3: Status & Location */}
                              {(char.currentStatus || char.currentLocation) && (
                                <div className="flex flex-wrap gap-2">
                                  {char.currentStatus && (
                                    <span className="px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-sm">
                                      💫 {char.currentStatus}
                                    </span>
                                  )}
                                  {char.currentLocation && (
                                    <span className="px-3 py-1.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-sm">
                                      📍 {char.currentLocation}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Row 4: Faction & Level */}
                              {(char.faction || char.cultivationLevel) && (
                                <div className="flex flex-wrap gap-2">
                                  {char.faction && (
                                    <span className="px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-sm">
                                      ⚔️ {char.faction}
                                    </span>
                                  )}
                                  {char.cultivationLevel && (
                                    <span className="px-3 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm">
                                      ⭐ {char.cultivationLevel}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                setEditingCharacter({ index: selectedCharacterIndex, character: char });
                                setIsCharacterModalOpen(true);
                              }}
                              className="w-9 h-9 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-400/50 flex items-center justify-center text-blue-300 hover:text-blue-200 transition-all"
                              title="编辑人物"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`确定要删除角色"${char.name || '未命名'}"吗？此操作无法撤销。`)) {
                                  const newChars = settings.characters.filter((_, i) => i !== selectedCharacterIndex);
                                  updateField('characters', newChars);
                                  if (selectedCharacterIndex >= newChars.length) {
                                    setSelectedCharacterIndex(Math.max(0, newChars.length - 1));
                                  }
                                }
                              }}
                              className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-400/50 flex items-center justify-center text-red-300 hover:text-red-200 transition-all"
                              title="删除人物"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {char.description && (
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">角色描述</label>
                            <p className="text-sm text-slate-300 leading-relaxed">{char.description}</p>
                          </div>
                        )}

                        {/* Relations */}
                        {char.relations && char.relations.length > 0 && (
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>🔗</span>
                              人物关系网
                            </label>
                            <div className="space-y-3">
                              {char.relations.map((relation, relIdx) => (
                                <div key={relIdx} className="bg-slate-950/60 border border-slate-700 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-bold text-rose-200">{relation.characterName}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      {relation.relationType}
                                    </span>
                                    {relation.relationStatus && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        {relation.relationStatus}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400 mb-1">
                                    <span className="text-slate-500">态度：</span>
                                    <span className="text-purple-300">{relation.attitude}</span>
                                  </div>
                                  <div className="text-xs text-slate-400 leading-relaxed mb-2">
                                    <span className="text-slate-500">渊源：</span>
                                    <span className="text-slate-300">{relation.background}</span>
                                  </div>
                                  {relation.latestInteraction && (
                                    <div className="mt-2 pt-2 border-t border-slate-800/50 text-xs text-slate-400">
                                      <span className="text-amber-400">💬 </span>
                                      <span className="text-slate-500">最新互动：</span>
                                      <span className="text-amber-200/80 italic">{relation.latestInteraction}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Items */}
                        {char.items && char.items.length > 0 && (
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>🎒</span>
                              道具 / 灵宠
                            </label>
                            <div className="space-y-3">
                              {char.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="bg-gradient-to-br from-purple-900/30 via-slate-900/40 to-slate-950/50 rounded-lg p-3 border border-purple-500/20">
                                  <div className="flex items-start gap-2">
                                    <span className="text-lg mt-0.5">✨</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold text-purple-200 text-sm mb-1">{item.name}</div>
                                      <div className="text-xs text-slate-400 leading-relaxed">{item.description}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Skills */}
                        {char.skills && char.skills.length > 0 && (
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>⚔️</span>
                              技能
                            </label>
                            <div className="space-y-3">
                              {char.skills.map((skill, skillIdx) => (
                                <div key={skillIdx} className="bg-gradient-to-br from-blue-900/30 via-slate-900/40 to-slate-950/50 rounded-lg p-3 border border-blue-500/20">
                                  <div className="flex items-start gap-2">
                                    <span className="text-lg mt-0.5">💫</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold text-blue-200 text-sm mb-1">{skill.name}</div>
                                      <div className="text-xs text-slate-400 leading-relaxed">{skill.description}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </Card>
      </div>

      {/* Full Width Section: Factions Gallery */}
      <div className="mt-6">
        {/* Section: Factions */}
        <Card icon="⚔️" title="势力档案 (动态更新)" action={
             <button
                onClick={() => {
                  setEditingFaction({
                    index: -1,
                    faction: { name: '', description: '', territory: '', members: [] }
                  });
                  setIsFactionModalOpen(true);
                }}
                className="group relative flex items-center gap-2 text-xs bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 text-red-200 hover:text-white px-4 py-2 rounded-xl border border-red-500/30 hover:border-red-400/50 transition-all shadow-lg hover:shadow-red-500/20 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-orange-400/20 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative text-lg">+</span>
                <span className="relative font-bold">手动添加</span>
              </button>
          }
          >
            {(!settings.factions || settings.factions.length === 0) ? (
              <div className="relative text-center py-16 text-slate-500 text-sm border-2 border-dashed border-red-500/20 rounded-2xl bg-gradient-to-br from-red-500/5 via-orange-500/5 to-yellow-500/5 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-4 right-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
                <div className="absolute bottom-4 left-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/20 via-orange-500/20 to-yellow-500/20 border border-red-500/30 flex items-center justify-center">
                    <span className="text-3xl">⚔️</span>
                  </div>
                  <p className="font-semibold text-slate-400">暂无势力信息</p>
                  <p className="text-xs text-slate-600 mt-2">随章节创作自动添加</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-6 h-[500px]">
                {/* Left: Faction List */}
                <div className="w-64 flex flex-col">
                  {/* Search Bar */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={factionSearchQuery}
                        onChange={(e) => setFactionSearchQuery(e.target.value)}
                        placeholder="搜索势力名称..."
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Faction Chips */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {(settings.factions || [])
                      .map((faction, idx) => ({ faction, idx }))
                      .filter(({ faction }) =>
                        !factionSearchQuery ||
                        faction.name.toLowerCase().includes(factionSearchQuery.toLowerCase()) ||
                        faction.territory.toLowerCase().includes(factionSearchQuery.toLowerCase())
                      )
                      .map(({ faction, idx }) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedFactionIndex(idx)}
                          className={`w-full text-left p-3 rounded-xl transition-all ${
                            selectedFactionIndex === idx
                              ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 border-2 border-red-500/50 shadow-lg'
                              : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                              selectedFactionIndex === idx
                                ? 'bg-gradient-to-br from-red-500/30 to-orange-500/30 border-2 border-red-400/50'
                                : 'bg-slate-800/50 border border-slate-700'
                            }`}>
                              ⚔️
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-bold text-sm truncate ${
                                selectedFactionIndex === idx ? 'text-red-200' : 'text-slate-300'
                              }`}>
                                {faction.name || '未命名'}
                              </div>
                              <div className={`text-xs truncate ${
                                selectedFactionIndex === idx ? 'text-orange-300' : 'text-slate-500'
                              }`}>
                                {faction.territory || '未设置地域'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Right: Faction Detail */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {(() => {
                    const faction = (settings.factions || [])[selectedFactionIndex];
                    if (!faction) return null;

                    return (
                      <div className="space-y-4">
                        {/* Header with Actions */}
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-red-200 via-orange-200 to-yellow-200 bg-clip-text text-transparent mb-1">
                              {faction.name || '未命名势力'}
                            </h3>
                            {faction.territory && (
                              <div className="flex gap-2">
                                <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold">
                                  📍 {faction.territory}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingFaction({ index: selectedFactionIndex, faction });
                                setIsFactionModalOpen(true);
                              }}
                              className="w-9 h-9 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-400/50 flex items-center justify-center text-blue-300 hover:text-blue-200 transition-all"
                              title="编辑势力"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`确定要删除势力"${faction.name || '未命名'}"吗？此操作无法撤销。`)) {
                                  const newFactions = (settings.factions || []).filter((_, i) => i !== selectedFactionIndex);
                                  updateField('factions', newFactions);
                                  if (selectedFactionIndex >= newFactions.length) {
                                    setSelectedFactionIndex(Math.max(0, newFactions.length - 1));
                                  }
                                }
                              }}
                              className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-400/50 flex items-center justify-center text-red-300 hover:text-red-200 transition-all"
                              title="删除势力"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {faction.description && (
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <label className="block text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">势力描述</label>
                            <p className="text-sm text-slate-300 leading-relaxed">{faction.description}</p>
                          </div>
                        )}

                        {/* Members */}
                        {faction.members && faction.members.length > 0 && (
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <label className="block text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>👥</span>
                              势力人物
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {faction.members.map((member, memberIdx) => (
                                <span
                                  key={memberIdx}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-200 border border-red-500/30 text-sm font-semibold"
                                >
                                  {member}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </Card>

        {/* Spacer between Faction and Location */}
        <div className="h-8"></div>

        {/* Location Archive Card */}
        <Card icon="🗺️" title="地点档案 (动态更新)" action={
             <button
                onClick={() => {
                  setEditingLocation({
                    index: -1,
                    location: { name: '', description: '', factions: [] }
                  });
                  setIsLocationModalOpen(true);
                }}
                className="group relative flex items-center gap-2 text-xs bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-teal-500/20 text-blue-200 hover:text-white px-4 py-2 rounded-xl border border-blue-500/30 hover:border-blue-400/50 transition-all shadow-lg hover:shadow-blue-500/20 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-cyan-400/20 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative text-lg">+</span>
                <span className="relative font-bold">手动添加</span>
              </button>
          }
          >
            {(!settings.locations || settings.locations.length === 0) ? (
              <div className="relative text-center py-16 text-slate-500 text-sm border-2 border-dashed border-blue-500/20 rounded-2xl bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-teal-500/5 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-4 right-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl" />
                <div className="absolute bottom-4 left-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-teal-500/20 border border-blue-500/30 flex items-center justify-center">
                    <span className="text-3xl">🗺️</span>
                  </div>
                  <p className="font-semibold text-slate-400">暂无地点信息</p>
                  <p className="text-xs text-slate-600 mt-2">随章节创作自动添加</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(settings.locations || []).map((location, idx) => (
                  <div key={idx} className="group relative backdrop-blur-sm bg-slate-950/60 border border-blue-500/30 rounded-2xl p-5 hover:border-blue-400/50 transition-all shadow-lg hover:shadow-blue-500/10">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border-2 border-blue-400/50 flex items-center justify-center text-lg">
                          🗺️
                        </div>
                        <div>
                          <h4 className="font-bold text-blue-200">{location.name}</h4>
                          {location.factions && location.factions.length > 0 && (
                            <p className="text-xs text-cyan-300">归属势力: {location.factions.join('、')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingLocation({ index: idx, location });
                            setIsLocationModalOpen(true);
                          }}
                          className="text-xs text-blue-300 hover:text-blue-200 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`确定删除地点"${location.name}"吗？`)) {
                              const newLocations = [...(settings.locations || [])];
                              newLocations.splice(idx, 1);
                              onUpdate({ locations: newLocations });
                            }
                          }}
                          className="text-xs text-red-300 hover:text-red-200 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{location.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
      </div>

      {/* Avatar Selector Modal */}
      {isAvatarSelectorOpen && avatarSelectorCharIndex !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/30 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold bg-gradient-to-r from-amber-200 via-purple-200 to-blue-200 bg-clip-text text-transparent">
                选择头像 - {settings.characters[avatarSelectorCharIndex]?.name || '未命名'}
              </h3>
              <button
                onClick={() => {
                  setIsAvatarSelectorOpen(false);
                  setAvatarSelectorCharIndex(null);
                }}
                className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 flex items-center justify-center text-red-300 hover:text-red-200 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-4 border-b border-slate-700/50">
              <button
                onClick={() => setAvatarSelectorTab('library')}
                className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                  avatarSelectorTab === 'library'
                    ? 'bg-gradient-to-r from-amber-500/30 to-purple-500/30 text-amber-200 border-2 border-amber-400/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                📚 素材库
              </button>
              <button
                onClick={() => setAvatarSelectorTab('upload')}
                className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                  avatarSelectorTab === 'upload'
                    ? 'bg-gradient-to-r from-amber-500/30 to-purple-500/30 text-amber-200 border-2 border-amber-400/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                📤 本地上传
              </button>
              <button
                onClick={() => setAvatarSelectorTab('ai')}
                className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                  avatarSelectorTab === 'ai'
                    ? 'bg-gradient-to-r from-amber-500/30 to-purple-500/30 text-amber-200 border-2 border-amber-400/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                🤖 AI生成
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] custom-scrollbar">
              {/* Library Tab */}
              {avatarSelectorTab === 'library' && (
                <div>
                  {/* Search Bar */}
                  <div className="mb-4">
                    <input
                      type="text"
                      value={avatarSearchQuery}
                      onChange={(e) => setAvatarSearchQuery(e.target.value)}
                      placeholder="搜索头像（如：仙侠、武侠、女主、男主...）"
                      className="w-full bg-slate-950/40 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                    />
                  </div>

                  <p className="text-sm text-slate-400 mb-4">
                    共 {availableAvatars.filter(path => {
                      if (!avatarSearchQuery) return true;
                      const filename = path.split('/').pop() || '';
                      return filename.toLowerCase().includes(avatarSearchQuery.toLowerCase());
                    }).length} 个头像
                  </p>

                  <div className="grid grid-cols-4 gap-4">
                    {availableAvatars
                      .filter(path => {
                        if (!avatarSearchQuery) return true;
                        const filename = path.split('/').pop() || '';
                        return filename.toLowerCase().includes(avatarSearchQuery.toLowerCase());
                      })
                      .map((avatarPath, idx) => {
                        const filename = avatarPath.split('/').pop() || '';
                        const displayName = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '');

                        return (
                          <button
                            key={idx}
                            onClick={() => selectAvatarFromLibrary(avatarPath)}
                            className="group relative rounded-xl overflow-hidden border-2 border-slate-700 hover:border-amber-500/50 transition-all"
                            title={displayName}
                          >
                            {/* Image container with fixed aspect ratio */}
                            <div className="aspect-square relative">
                              <img
                                src={avatarPath}
                                alt={displayName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Hide broken images
                                  const parent = (e.target as HTMLElement).parentElement?.parentElement;
                                  if (parent) parent.style.display = 'none';
                                }}
                              />
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-sm font-medium">选择</span>
                              </div>
                            </div>
                            {/* Filename label */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2">
                              <p className="text-xs text-white truncate">{displayName}</p>
                            </div>
                          </button>
                        );
                      })}
                  </div>

                  {availableAvatars.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <div className="text-4xl mb-4">📁</div>
                      <p>素材库为空</p>
                      <p className="text-xs mt-2">请将头像图片放入 public/avatars/ 文件夹</p>
                      <p className="text-xs mt-2 text-slate-600">然后运行命令生成清单文件</p>
                    </div>
                  )}

                  {availableAvatars.length > 0 && availableAvatars.filter(path => {
                    if (!avatarSearchQuery) return true;
                    const filename = path.split('/').pop() || '';
                    return filename.toLowerCase().includes(avatarSearchQuery.toLowerCase());
                  }).length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <div className="text-4xl mb-4">🔍</div>
                      <p>未找到匹配的头像</p>
                      <p className="text-xs mt-2">尝试其他关键词</p>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Tab */}
              {avatarSelectorTab === 'upload' && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-6">📤</div>
                  <p className="text-slate-400 mb-6">上传本地图片作为头像（最大 2MB）</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <span className="cursor-pointer px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-200 border border-blue-500/30 hover:border-blue-400/50 transition-all font-medium">
                      选择文件
                    </span>
                  </label>
                  <p className="text-xs text-slate-600 mt-4">支持 JPG、PNG、WEBP 格式</p>
                </div>
              )}

              {/* AI Generation Tab */}
              {avatarSelectorTab === 'ai' && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-6">🤖</div>
                  <p className="text-slate-400 mb-6">
                    使用 AI 为 {settings.characters[avatarSelectorCharIndex]?.name} 生成专属头像
                  </p>
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                    <div className="text-sm text-slate-300 space-y-2">
                      <p><strong>角色信息：</strong></p>
                      <p>• 姓名: {settings.characters[avatarSelectorCharIndex]?.name || '未命名'}</p>
                      {settings.characters[avatarSelectorCharIndex]?.gender && (
                        <p>• 性别: {settings.characters[avatarSelectorCharIndex].gender}</p>
                      )}
                      {settings.characters[avatarSelectorCharIndex]?.age && (
                        <p>• 年龄: {settings.characters[avatarSelectorCharIndex].age}</p>
                      )}
                      {settings.characters[avatarSelectorCharIndex]?.description && (
                        <p>• 描述: {settings.characters[avatarSelectorCharIndex].description.slice(0, 50)}...</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateSingleAvatar}
                    disabled={isGeneratingSingleAvatar}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-200 border border-purple-500/30 hover:border-purple-400/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingSingleAvatar ? '生成中...' : '🎨 生成头像'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldBuilding;
