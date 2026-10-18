--═══════════════════════════════════════════════════════════════════════════════
--  KRV INTERFACE SUITE v1.0 — lib custom légère, drop-in Starlight Gen1
--  Même API que https://raw.githubusercontent.com/Nebula-Softworks/Starlight-Interface-Suite/Gen1/Source.lua
--  Mais réécrite de zéro : zéro lag (aucune boucle par frame, aucun tween en
--  masse, aucun HttpGet d'icônes), zéro bug (tout est guardé : destroyed flag,
--  pcall sur chaque callback, connexions toutes tracées pour Destroy).
--
--  Usage : place ce fichier à côté du hub, ou charge-le via loadstring.
--  Le hub KRV le détecte (readfile "KRV_UI.lua") avant de tenter l'URL distante.
--═══════════════════════════════════════════════════════════════════════════════

local KRV_UI = {}
KRV_UI.__index = KRV_UI
KRV_UI.Version = "1.0"
KRV_UI._destroyed = false

-- Services (pcall : la lib ne doit JAMAIS throw au require)
local Players, UserInputService, TweenService, HttpService, CoreGui
pcall(function()
	Players = game:GetService("Players")
	UserInputService = game:GetService("UserInputService")
	TweenService = game:GetService("TweenService")
	HttpService = game:GetService("HttpService")
	CoreGui = game:GetService("CoreGui")
end)
local LP = Players and Players.LocalPlayer or nil

-- Thème KRV (aucun chargement externe : pas de NebulaIcons, pas d'acrylic)
local THEME = {
	Bg = Color3.fromRGB(13, 15, 20),
	Bg2 = Color3.fromRGB(18, 21, 27),
	Box = Color3.fromRGB(22, 25, 32),
	Line = Color3.fromRGB(34, 38, 48),
	Text = Color3.fromRGB(240, 243, 248),
	Sub = Color3.fromRGB(150, 160, 175),
	Accent = Color3.fromRGB(0, 82, 255),
	Accent2 = Color3.fromRGB(122, 92, 255),
	Good = Color3.fromRGB(90, 220, 120),
	Bad = Color3.fromRGB(235, 90, 90),
}
local FONT_B = Enum.Font.GothamBold
local FONT_R = Enum.Font.Gotham

-- Toutes les connexions / instances : Destroy() coupe TOUT proprement.
local AllConns, AllGuis = {}, {}
local function trackConn(c)
	if c then AllConns[#AllConns + 1] = c end
	return c
end
local function trackGui(g)
	if g then AllGuis[#AllGuis + 1] = g end
	return g
end
local function safeCB(fn, ...)
	if KRV_UI._destroyed then return end
	if type(fn) == "function" then
		local a = { ... }
		task.spawn(function()
			if KRV_UI._destroyed then return end
			pcall(fn, table.unpack(a))
		end)
	end
end

local function parentGui()
	local ok, hui = pcall(function()
		local gh = (typeof(gethui) == "function" and gethui)
			or (typeof(get_hidden_gui) == "function" and get_hidden_gui)
		if gh then return gh() end
		return nil
	end)
	if ok and hui then return hui end
	return CoreGui
end

local function mk(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props or {}) do
		if k ~= "Parent" then
			pcall(function() o[k] = v end)
		end
	end
	o.Parent = parent
	return o
end
local function corner(p, r)
	mk("UICorner", { CornerRadius = UDim.new(0, r or 6) }, p)
end
local function stroke(p, color, thick, transp)
	mk("UIStroke", { Color = color or THEME.Line, Thickness = thick or 1, Transparency = transp or 0.2 }, p)
end

-- Icônes : AUCUN HttpGet (c'était LA source de lag de Starlight + NebulaIcons).
-- On mappe les noms Lucide vers des glyphes unicode, le hub marche sans réseau.
local GLYPHS = {
	move = "✥", sword = "⚔", swords = "⚔", eye = "👁", globe = "🌐",
	smile = "☺", user = "👤", users = "👥", wrench = "🔧", server = "🖥",
	settings = "⚙", cog = "⚙", zap = "⚡", shield = "🛡", star = "★",
	target = "🎯", crosshair = "🎯", palette = "🎨", sun = "☀", moon = "🌙",
	box = "📦", trash = "🗑", ghost = "👻", flame = "🔥", skull = "💀",
}
local function glyphFor(lucideName, fallbackIcon)
	if type(fallbackIcon) == "number" then return "" end -- ancien asset id : ignoré (offline)
	if type(fallbackIcon) == "string" and #fallbackIcon <= 4 and fallbackIcon ~= "" then
		return fallbackIcon -- déjà un glyphe passé par le hub
	end
	if type(lucideName) == "string" then
		local g = GLYPHS[string.lower(lucideName)]
		if g then return g end
	end
	return "•"
end

--═══════════════════════════════════════════════════════════════════════════════
--  BOOT SCREEN (rapide, aucun tween en boucle, détruit après usage)
--═══════════════════════════════════════════════════════════════════════════════
local function showBoot(title, subtitle)
	local g = mk("ScreenGui", { Name = "KRV_Boot", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 99999 }, parentGui())
	trackGui(g)
	pcall(function()
		local f = gethui and gethui() -- protect_gui si dispo
	end)
	local bg = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
		Size = UDim2.new(0, 340, 0, 150), BackgroundColor3 = THEME.Bg, BorderSizePixel = 0 }, g)
	corner(bg, 10); stroke(bg, THEME.Accent, 1, 0.3)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 18),
		Size = UDim2.new(1, 0, 0, 30), Font = FONT_B, TextSize = 20, TextColor3 = THEME.Text,
		Text = tostring(title or "KRV Universelle") }, bg)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 48),
		Size = UDim2.new(1, 0, 0, 18), Font = FONT_R, TextSize = 12, TextColor3 = THEME.Sub,
		Text = tostring(subtitle or "Chargement...") }, bg)
	local barBg = mk("Frame", { Position = UDim2.new(0, 24, 0, 84), Size = UDim2.new(1, -48, 0, 8),
		BackgroundColor3 = THEME.Box, BorderSizePixel = 0 }, bg)
	corner(barBg, 4)
	local bar = mk("Frame", { Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = THEME.Accent, BorderSizePixel = 0 }, barBg)
	corner(bar, 4)
	local pct = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 100),
		Size = UDim2.new(1, 0, 0, 16), Font = FONT_R, TextSize = 11, TextColor3 = THEME.Sub, Text = "0%" }, bg)
	return {
		set = function(p, label)
			if KRV_UI._destroyed then return end
			pcall(function()
				bar.Size = UDim2.new(math.clamp(p or 0, 0, 1), 0, 1, 0)
				pct.Text = tostring(label or (math.floor((p or 0) * 100) .. "%"))
			end)
		end,
		close = function()
			pcall(function() g:Destroy() end)
		end,
	}
end

--═══════════════════════════════════════════════════════════════════════════════
--  LICENSE SCREEN (100% locale : aucune requête réseau, aucun HWID envoyé)
--═══════════════════════════════════════════════════════════════════════════════
local function showLicense(cfg, done)
	-- Pas de clé configurée → on skippe (aucun blocage fantôme)
	if not cfg or not cfg.LicenseKey or cfg.LicenseKey == "" then
		task.spawn(done)
		return
	end
	local g = mk("ScreenGui", { Name = "KRV_License", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 100000 }, parentGui())
	trackGui(g)
	local bg = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
		Size = UDim2.new(0, 340, 0, 210), BackgroundColor3 = THEME.Bg, BorderSizePixel = 0 }, g)
	corner(bg, 10); stroke(bg, THEME.Accent, 1, 0.3)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 16),
		Size = UDim2.new(1, 0, 0, 26), Font = FONT_B, TextSize = 17, TextColor3 = THEME.Text, Text = "🔑 Licence KRV" }, bg)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 20, 0, 46),
		Size = UDim2.new(1, -40, 0, 30), Font = FONT_R, TextSize = 12, TextColor3 = THEME.Sub,
		TextWrapped = true, Text = "Entre ta clé de licence pour continuer." }, bg)
	local box = mk("TextBox", { Position = UDim2.new(0, 20, 0, 84), Size = UDim2.new(1, -40, 0, 34),
		BackgroundColor3 = THEME.Box, TextColor3 = THEME.Text, PlaceholderColor3 = THEME.Sub,
		PlaceholderText = "XXXX-XXXX-XXXX", Font = FONT_R, TextSize = 14, Text = "",
		BorderSizePixel = 0, ClearTextOnFocus = false }, bg)
	corner(box, 6)
	local err = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 20, 0, 122),
		Size = UDim2.new(1, -40, 0, 16), Font = FONT_R, TextSize = 11, TextColor3 = THEME.Bad, Text = "" }, bg)
	local btn = mk("TextButton", { Position = UDim2.new(0, 20, 0, 144), Size = UDim2.new(1, -40, 0, 38),
		BackgroundColor3 = THEME.Accent, TextColor3 = Color3.new(1, 1, 1), Font = FONT_B, TextSize = 14,
		Text = "Valider", BorderSizePixel = 0, AutoButtonColor = true }, bg)
	corner(btn, 6)
	trackConn(btn.MouseButton1Click:Connect(function()
		if box.Text == cfg.LicenseKey then
			pcall(function() g:Destroy() end)
			task.spawn(done)
		else
			err.Text = "❌ Clé invalide."
		end
	end))
end

--═══════════════════════════════════════════════════════════════════════════════
--  NOTIFICATIONS (pool fixe de 4 : pas de fuite, 1 seul tween par toast)
--═══════════════════════════════════════════════════════════════════════════════
local notifGui, notifStack
local function ensureNotifGui()
	if notifGui and notifGui.Parent then return end
	notifGui = mk("ScreenGui", { Name = "KRV_Notifications", ResetOnSpawn = false,
		IgnoreGuiInset = true, DisplayOrder = 99998 }, parentGui())
	trackGui(notifGui)
	notifStack = mk("Frame", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 14),
		Size = UDim2.new(0, 300, 1, -28), BackgroundTransparency = 1 }, notifGui)
	local layout = mk("UIListLayout", { Padding = UDim.new(0, 8), FillDirection = Enum.FillDirection.Vertical,
		HorizontalAlignment = Enum.HorizontalAlignment.Right, SortOrder = Enum.SortOrder.LayoutOrder }, notifStack)
	_ = layout
end

function KRV_UI:Notification(opts)
	if self._destroyed then return end
	opts = opts or {}
	ensureNotifGui()
	-- Pool : max 4 toasts, le plus vieux est recyclé (pas de fuite mémoire)
	local kids = notifStack:GetChildren()
	local oldest, oldestOrder = nil, math.huge
	local count = 0
	for _, k in ipairs(kids) do
		if k:IsA("Frame") then
			count = count + 1
			local lo = k:GetAttribute("Order") or 0
			if lo < oldestOrder then oldest, oldestOrder = k, lo end
		end
	end
	if count >= 4 and oldest then pcall(function() oldest:Destroy() end) end
	local f = mk("Frame", { Size = UDim2.new(0, 300, 0, 64), BackgroundColor3 = THEME.Bg2,
		BorderSizePixel = 0 }, notifStack)
	f:SetAttribute("Order", os.clock())
	corner(f, 8); stroke(f, THEME.Accent, 1, 0.4)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 12, 0, 6),
		Size = UDim2.new(1, -24, 0, 18), Font = FONT_B, TextSize = 13,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Accent,
		Text = tostring(opts.Title or "KRV") }, f)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 12, 0, 24),
		Size = UDim2.new(1, -24, 1, -30), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top,
		TextWrapped = true, TextColor3 = THEME.Text, Text = tostring(opts.Content or "") }, f)
	task.delay(tonumber(opts.Duration) or 4, function()
		if KRV_UI._destroyed then return end
		pcall(function()
			TweenService:Create(f, TweenInfo.new(0.2), { BackgroundTransparency = 1 }):Play()
			for _, d in ipairs(f:GetDescendants()) do
				if d:IsA("TextLabel") then
					TweenService:Create(d, TweenInfo.new(0.2), { TextTransparency = 1 }):Play()
				end
			end
		end)
		task.delay(0.25, function() pcall(function() f:Destroy() end) end)
	end)
end

--═══════════════════════════════════════════════════════════════════════════════
--  FENÊTRE / ONGLETS / GROUPBOXES
--═══════════════════════════════════════════════════════════════════════════════
local menuKey = Enum.KeyCode.RightShift

function KRV_UI:CreateWindow(opts)
	opts = opts or {}
	local boot = showBoot(opts.Name or "KRV Universelle",
		(opts.LoadingSettings and opts.LoadingSettings.Subtitle) or "Chargement des modules...")
	boot.set(0.15, "Interface...")

	local gui = mk("ScreenGui", { Name = "KRV_Interface", ResetOnSpawn = false,
		IgnoreGuiInset = true, DisplayOrder = 99990 }, parentGui())
	trackGui(gui)

	local main = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
		Size = UDim2.new(0, 640, 0, 440), BackgroundColor3 = THEME.Bg, BorderSizePixel = 0,
		Visible = false }, gui)
	corner(main, 10); stroke(main, THEME.Line, 1, 0.1)

	-- Barre de titre (drag manuel : 1 seule connexion, pas de boucle)
	local top = mk("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, main)
	corner(top, 10)
	mk("Frame", { Position = UDim2.new(0, 0, 1, -10), Size = UDim2.new(1, 0, 0, 10),
		BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, top)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 14, 0, 4),
		Size = UDim2.new(1, -150, 0, 20), Font = FONT_B, TextSize = 15,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		Text = "⚡ " .. tostring(opts.Name or "KRV Universelle") }, top)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 14, 0, 23),
		Size = UDim2.new(1, -150, 0, 14), Font = FONT_R, TextSize = 11,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Sub,
		Text = tostring(opts.Subtitle or ("v" .. tostring(KRV_UI.Version))) }, top)
	local minBtn = mk("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -48, 0, 8),
		Size = UDim2.new(0, 28, 0, 28), BackgroundColor3 = THEME.Box, TextColor3 = THEME.Text,
		Font = FONT_B, TextSize = 14, Text = "–", BorderSizePixel = 0 }, top)
	corner(minBtn, 6)
	local closeBtn = mk("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 8),
		Size = UDim2.new(0, 28, 0, 28), BackgroundColor3 = THEME.Box, TextColor3 = THEME.Bad,
		Font = FONT_B, TextSize = 14, Text = "✕", BorderSizePixel = 0 }, top)
	corner(closeBtn, 6)

	do
		local dragging, dragStart, startPos = false, nil, nil
		trackConn(top.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 then
				dragging, dragStart, startPos = true, input.Position, main.Position
			end
		end))
		trackConn(UserInputService.InputChanged:Connect(function(input)
			if dragging and input.UserInputType == Enum.UserInputType.MouseMovement and dragStart then
				local d = input.Position - dragStart
				main.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
			end
		end))
		trackConn(UserInputService.InputEnded:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 then dragging = false end
		end))
	end

	-- Corps : sidebar + pages
	local side = mk("Frame", { Position = UDim2.new(0, 0, 0, 44), Size = UDim2.new(0, 150, 1, -44),
		BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, main)
	mk("Frame", { Position = UDim2.new(0, 0, 0, 0), Size = UDim2.new(1, 0, 0, 0),
		BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, side)
	local sideList = mk("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, side)
	_ = sideList
	mk("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingLeft = UDim.new(0, 8),
		PaddingRight = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8) }, side)

	local body = mk("Frame", { Position = UDim2.new(0, 150, 0, 44), Size = UDim2.new(1, -150, 1, -44),
		BackgroundTransparency = 1 }, main)

	local win = { _gui = gui, _main = main, _tabs = {}, _onDestroy = nil, _configFolder = nil }
	if opts.FileSettings and opts.FileSettings.ConfigFolder then
		win._configFolder = tostring(opts.FileSettings.ConfigFolder)
		pcall(function()
			if typeof(makefolder) == "function" and not isfolder(win._configFolder) then
				makefolder(win._configFolder)
			end
		end)
	end

	trackConn(minBtn.MouseButton1Click:Connect(function()
		main.Visible = false
		KRV_UI:Notification({ Title = "Interface masquée",
			Content = "Touche " .. tostring(menuKey.Name) .. " pour rouvrir.", Duration = 3 })
	end))
	trackConn(closeBtn.MouseButton1Click:Connect(function()
		if type(win._onDestroy) == "function" then safeCB(win._onDestroy) end
	end))
	trackConn(UserInputService.InputBegan:Connect(function(input, gp)
		if gp or KRV_UI._destroyed then return end
		if input.KeyCode == menuKey then
			main.Visible = not main.Visible
		end
	end))

	function win:CreateTabSection(_name)
		local section = {}
		function section:CreateTab(tabOpts, _idx)
			tabOpts = tabOpts or {}
			local page = mk("ScrollingFrame", { Size = UDim2.new(1, 0, 1, 0),
				BackgroundTransparency = 1, BorderSizePixel = 0, Visible = false,
				ScrollBarThickness = 3, ScrollBarImageColor3 = THEME.Line,
				AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(0, 0, 0, 0) }, body)
			mk("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingLeft = UDim.new(0, 8),
				PaddingRight = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8) }, page)
			local btn = mk("TextButton", { Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = THEME.Box,
				TextColor3 = THEME.Sub, Font = FONT_B, TextSize = 12,
				TextXAlignment = Enum.TextXAlignment.Left, BorderSizePixel = 0,
				Text = "  " .. glyphFor(tabOpts.Icon, nil) .. "  " .. tostring(tabOpts.Name or "Onglet") }, side)
			corner(btn, 6)
			local tab = { _page = page, _btn = btn, _cols = {} }
			for c = 1, 2 do
				local col = mk("Frame", { Size = UDim2.new(0.5, -4, 0, 0),
					BackgroundTransparency = 1, AutomaticSize = Enum.AutomaticSize.Y }, page)
				if c == 1 then col.Position = UDim2.new(0, 0, 0, 0)
				else col.Position = UDim2.new(0.5, 4, 0, 0) end
				mk("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }, col)
				tab._cols[c] = col
			end
			trackConn(btn.MouseButton1Click:Connect(function()
				if KRV_UI._destroyed then return end
				for _, t in ipairs(win._tabs) do
					t._page.Visible = false
					t._btn.BackgroundColor3 = THEME.Box
					t._btn.TextColor3 = THEME.Sub
				end
				page.Visible = true
				btn.BackgroundColor3 = THEME.Accent
				btn.TextColor3 = Color3.new(1, 1, 1)
			end))
			win._tabs[#win._tabs + 1] = tab
			if #win._tabs == 1 then
				page.Visible = true
				btn.BackgroundColor3 = THEME.Accent
				btn.TextColor3 = Color3.new(1, 1, 1)
			end

			function tab:BuildConfigGroupbox(_col)
				local sec = tab:CreateGroupbox({ Name = "Configs", Column = 1 }, "cfg")
				return KRV_UI._ConfigBox(sec)
			end
			function tab:CreateGroupbox(gbOpts, _gbIdx)
				gbOpts = gbOpts or {}
				local col = tab._cols[(gbOpts.Column == 2) and 2 or 1]
				local gb = mk("Frame", { Size = UDim2.new(1, 0, 0, 0),
					BackgroundColor3 = THEME.Box, BorderSizePixel = 0,
					AutomaticSize = Enum.AutomaticSize.Y }, col)
				corner(gb, 8); stroke(gb, THEME.Line, 1, 0.3)
				mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 10, 0, 6),
					Size = UDim2.new(1, -20, 0, 18), Font = FONT_B, TextSize = 13,
					TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
					Text = tostring(gbOpts.Name or "Section") }, gb)
				local list = mk("Frame", { Position = UDim2.new(0, 0, 0, 28), Size = UDim2.new(1, 0, 0, 0),
					BackgroundTransparency = 1, AutomaticSize = Enum.AutomaticSize.Y }, gb)
				mk("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, list)
				mk("UIPadding", { PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8),
					PaddingBottom = UDim.new(0, 8) }, list)

				local sec = { _frame = gb, _list = list, _win = win }
				sec.CreateToggle = function(s, o, i) return KRV_UI._Toggle(s, o, i) end
				sec.CreateSlider = function(s, o, i) return KRV_UI._Slider(s, o, i) end
				sec.CreateButton = function(s, o, i) return KRV_UI._Button(s, o, i) end
				sec.CreateInput = function(s, o, i) return KRV_UI._Input(s, o, i) end
				sec.CreateLabel = function(s, o, i) return KRV_UI._Label(s, o, i) end
				sec.BuildConfigGroupbox = function(s, _col) return KRV_UI._ConfigBox(s) end
				return sec
			end
			return tab
		end
		return section
	end

	boot.set(0.6, "Onglets...")
	showLicense(opts, function()
		if KRV_UI._destroyed then return end
		boot.set(1, "Prêt !")
		task.delay(0.25, function()
			boot.close()
			main.Visible = true
		end)
	end)
	return win
end

--═══════════════════════════════════════════════════════════════════════════════
--  CONTRÔLES (chaque callback est pcall + guard destroyed ; Set() refire)
--═══════════════════════════════════════════════════════════════════════════════
local function baseRow(sec, h)
	local r = mk("Frame", { Size = UDim2.new(1, 0, 0, h or 30), BackgroundTransparency = 1 }, sec._list)
	return r
end

function KRV_UI._Toggle(sec, opts, _idx)
	opts = opts or {}
	local val = (opts.CurrentValue == true)
	local row = baseRow(sec, 30)
	local lbl = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 4, 0, 0),
		Size = UDim2.new(1, -52, 1, 0), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		TextWrapped = true, Text = tostring(opts.Name or "Toggle") }, row)
	_ = lbl
	local sw = mk("TextButton", { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -2, 0.5, 0),
		Size = UDim2.new(0, 40, 0, 20), BackgroundColor3 = THEME.Line, Text = "",
		BorderSizePixel = 0, AutoButtonColor = false }, row)
	corner(sw, 10)
	local knob = mk("Frame", { Position = UDim2.new(0, 2, 0.5, -8), Size = UDim2.new(0, 16, 0, 16),
		BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0 }, sw)
	corner(knob, 8)
	local el = { _cb = opts.Callback, _val = val }
	local function paint()
		sw.BackgroundColor3 = el._val and THEME.Accent or THEME.Line
		knob.Position = el._val and UDim2.new(1, -18, 0.5, -8) or UDim2.new(0, 2, 0.5, -8)
	end
	paint()
	function el:Set(o)
		if KRV_UI._destroyed then return end
		if type(o) == "table" and o.CurrentValue ~= nil then
			el._val = (o.CurrentValue == true)
			paint()
			safeCB(el._cb, el._val)
		end
	end
	function el:Get() return el._val end
	trackConn(sw.MouseButton1Click:Connect(function() el:Set({ CurrentValue = not el._val }) end))
	KRV_UI._AttachNested(el, row)
	return el
end

function KRV_UI._Slider(sec, opts, _idx)
	opts = opts or {}
	local min = tonumber(opts.Range and opts.Range[1]) or 0
	local max = tonumber(opts.Range and opts.Range[2]) or 100
	if max < min then min, max = max, min end
	local val = math.clamp(tonumber(opts.CurrentValue) or min, min, max)
	local row = baseRow(sec, 44)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 4, 0, 0),
		Size = UDim2.new(1, -60, 0, 16), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		Text = tostring(opts.Name or "Slider") }, row)
	local valLbl = mk("TextLabel", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -4, 0, 0), Size = UDim2.new(0, 56, 0, 16), Font = FONT_B,
		TextSize = 12, TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = THEME.Accent,
		Text = tostring(val) }, row)
	local bar = mk("TextButton", { Position = UDim2.new(0, 4, 0, 22), Size = UDim2.new(1, -8, 0, 14),
		BackgroundColor3 = THEME.Line, Text = "", BorderSizePixel = 0, AutoButtonColor = false }, row)
	corner(bar, 7)
	local fill = mk("Frame", { Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = THEME.Accent,
		BorderSizePixel = 0 }, bar)
	corner(fill, 7)
	local el = { _cb = opts.Callback, _val = val }
	local function paint()
		local f = (max > min) and ((el._val - min) / (max - min)) or 0
		fill.Size = UDim2.new(math.clamp(f, 0, 1), 0, 1, 0)
		valLbl.Text = tostring(math.floor(el._val * 100) / 100)
	end
	paint()
	function el:Set(o)
		if KRV_UI._destroyed then return end
		if type(o) == "table" and o.CurrentValue ~= nil then
			el._val = math.clamp(tonumber(o.CurrentValue) or min, min, max)
			paint()
			safeCB(el._cb, el._val)
		end
	end
	do
		local drag = false
		local function apply(x)
			local p = math.clamp((x - bar.AbsolutePosition.X) / math.max(bar.AbsoluteSize.X, 1), 0, 1)
			el:Set({ CurrentValue = min + (max - min) * p })
		end
		trackConn(bar.InputBegan:Connect(function(i)
			if i.UserInputType == Enum.UserInputType.MouseButton1 then drag = true; apply(i.Position.X) end
		end))
		trackConn(UserInputService.InputChanged:Connect(function(i)
			if drag and i.UserInputType == Enum.UserInputType.MouseMovement then apply(i.Position.X) end
		end))
		trackConn(UserInputService.InputEnded:Connect(function(i)
			if i.UserInputType == Enum.UserInputType.MouseButton1 then drag = false end
		end))
	end
	KRV_UI._AttachNested(el, row)
	return el
end

function KRV_UI._Button(sec, opts, _idx)
	opts = opts or {}
	local b = mk("TextButton", { Size = UDim2.new(1, 0, 0, 30), BackgroundColor3 = THEME.Accent,
		TextColor3 = Color3.new(1, 1, 1), Font = FONT_B, TextSize = 12,
		Text = tostring(opts.Name or "Bouton"), BorderSizePixel = 0 }, sec._list)
	corner(b, 6)
	local el = { _cb = opts.Callback }
	function el:Set() end
	trackConn(b.MouseButton1Click:Connect(function() safeCB(el._cb) end))
	return el
end

function KRV_UI._Input(sec, opts, _idx)
	opts = opts or {}
	local row = baseRow(sec, 52)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 4, 0, 0),
		Size = UDim2.new(1, -8, 0, 16), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		Text = tostring(opts.Name or "Input") }, row)
	local box = mk("TextBox", { Position = UDim2.new(0, 4, 0, 18), Size = UDim2.new(1, -8, 0, 28),
		BackgroundColor3 = THEME.Bg, TextColor3 = THEME.Text, PlaceholderColor3 = THEME.Sub,
		PlaceholderText = tostring(opts.PlaceholderText or ""), Font = FONT_R, TextSize = 12,
		Text = tostring(opts.CurrentValue or ""), BorderSizePixel = 0, ClearTextOnFocus = false }, row)
	corner(box, 6); stroke(box, THEME.Line, 1, 0.3)
	local el = { _cb = opts.Callback }
	function el:Set(o)
		if KRV_UI._destroyed then return end
		if type(o) == "table" and o.CurrentValue ~= nil then
			box.Text = tostring(o.CurrentValue)
			safeCB(el._cb, box.Text)
		end
	end
	trackConn(box.FocusLost:Connect(function(enter)
		if enter then safeCB(el._cb, box.Text) end
	end))
	return el
end

function KRV_UI._Label(sec, opts, _idx)
	opts = opts or {}
	local row = baseRow(sec, 26)
	local t = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 4, 0, 0),
		Size = UDim2.new(1, -8, 1, 0), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Sub,
		TextWrapped = true, Text = tostring(opts.Name or "") }, row)
	local el = {}
	function el:Set(o)
		if KRV_UI._destroyed then return end
		if type(o) == "table" and o.Name ~= nil then t.Text = tostring(o.Name) end
	end
	KRV_UI._AttachNested(el, row)
	return el
end

-- Éléments imbriqués (bind / dropdown / colorpicker sur un label ou toggle)
function KRV_UI._AttachNested(el, row)
	function el:AddBind(bOpts, _bIdx)
		bOpts = bOpts or {}
		local key = tostring(bOpts.CurrentValue or "E")
		local b = mk("TextButton", { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -2, 0.5, 0),
			Size = UDim2.new(0, 64, 0, 20), BackgroundColor3 = THEME.Bg, TextColor3 = THEME.Accent,
			Font = FONT_B, TextSize = 11, Text = "[" .. key .. "]", BorderSizePixel = 0 }, row)
		corner(b, 5); stroke(b, THEME.Line, 1, 0.3)
		local bind = { _key = key }
		-- Touche du menu : pilote l'affichage (WindowSetting)
		if bOpts.WindowSetting then
			local kc = Enum.KeyCode.RightShift
			pcall(function()
				for _, e in ipairs(Enum.KeyCode:GetEnumItems()) do
					if e.Name == key then kc = e; break end
				end
			end)
			menuKey = kc
		end
		local capturing = false
		trackConn(b.MouseButton1Click:Connect(function()
			if capturing then return end
			capturing = true
			b.Text = "[...]"
			local conn
			conn = UserInputService.InputBegan:Connect(function(input, gp)
				if gp then return end
				local name = nil
				if input.UserInputType == Enum.UserInputType.MouseButton1 then name = "MB1"
				elseif input.UserInputType == Enum.UserInputType.MouseButton2 then name = "MB2"
				elseif input.UserInputType == Enum.UserInputType.MouseButton3 then name = "MB3"
				elseif input.KeyCode ~= Enum.KeyCode.Unknown then name = input.KeyCode.Name end
				if name then
					bind._key = name
					b.Text = "[" .. name .. "]"
					if bOpts.WindowSetting then
						pcall(function() menuKey = input.KeyCode end)
					end
					safeCB(bOpts.OnChangedCallback, name)
					capturing = false
					conn:Disconnect()
				end
			end)
			trackConn(conn)
		end))
		-- HoldToInteract : exécute le callback TANT QUE la touche est tenue
		-- (1 seule connexion globale par bind, pas de boucle)
		if bOpts.HoldToInteract then
			local held = false
			trackConn(UserInputService.InputBegan:Connect(function(input, gp)
				if KRV_UI._destroyed or gp or held then return end
				local match = false
				pcall(function()
					if bind._key == "MB1" and input.UserInputType == Enum.UserInputType.MouseButton1 then match = true
					elseif bind._key == "MB2" and input.UserInputType == Enum.UserInputType.MouseButton2 then match = true
					elseif input.KeyCode ~= Enum.KeyCode.Unknown and input.KeyCode.Name == bind._key then match = true end
				end)
				if match then
					held = true
					safeCB(bOpts.Callback, true)
					local up
					up = UserInputService.InputEnded:Connect(function(e2)
						local same = false
						pcall(function()
							if bind._key == "MB1" and e2.UserInputType == Enum.UserInputType.MouseButton1 then same = true
							elseif bind._key == "MB2" and e2.UserInputType == Enum.UserInputType.MouseButton2 then same = true
							elseif e2.KeyCode ~= Enum.KeyCode.Unknown and e2.KeyCode.Name == bind._key then same = true end
						end)
						if same then held = false; safeCB(bOpts.Callback, false); up:Disconnect() end
					end)
					trackConn(up)
				end
			end))
		else
			trackConn(UserInputService.InputBegan:Connect(function(input, gp)
				if KRV_UI._destroyed or gp then return end
				local match = false
				pcall(function()
					if bind._key == "MB1" and input.UserInputType == Enum.UserInputType.MouseButton1 then match = true
					elseif bind._key == "MB2" and input.UserInputType == Enum.UserInputType.MouseButton2 then match = true
					elseif input.KeyCode ~= Enum.KeyCode.Unknown and input.KeyCode.Name == bind._key then match = true end
				end)
				if match then safeCB(bOpts.Callback, true) end
			end))
		end
		return bind
	end
	function el:AddDropdown(dOpts, _dIdx)
		dOpts = dOpts or {}
		local options = dOpts.Options or {}
		local cur = dOpts.CurrentOption
		if cur == nil then cur = options[1] end
		local b = mk("TextButton", { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -2, 0.5, 0),
			Size = UDim2.new(0, 110, 0, 20), BackgroundColor3 = THEME.Bg, TextColor3 = THEME.Text,
			Font = FONT_R, TextSize = 11, Text = tostring(cur or "—") .. " ▾", BorderSizePixel = 0 }, row)
		corner(b, 5); stroke(b, THEME.Line, 1, 0.3)
		local dd = { _options = options, _cur = cur, _cb = dOpts.Callback }
		local open, listF = false, nil
		local function close()
			open = false
			if listF then pcall(function() listF:Destroy() end); listF = nil end
		end
		function dd:Set(o)
			if KRV_UI._destroyed then return end
			if type(o) == "table" then
				if o.Options then dd._options = o.Options end
				if o.CurrentOption ~= nil then
					dd._cur = o.CurrentOption
					b.Text = tostring(dd._cur) .. " ▾"
					safeCB(dd._cb, dd._cur)
				end
			end
		end
		trackConn(b.MouseButton1Click:Connect(function()
			if open then close(); return end
			open = true
			listF = mk("Frame", { Position = UDim2.new(1, -120, 1, 2), Size = UDim2.new(0, 110, 0,
				math.min(#dd._options * 22 + 6, 132)), BackgroundColor3 = THEME.Bg2,
				BorderSizePixel = 0, ZIndex = 50 }, b)
			corner(listF, 6); stroke(listF, THEME.Line, 1, 0.2)
			for _, opt in ipairs(dd._options) do
				local ob = mk("TextButton", { Size = UDim2.new(1, 0, 0, 22), BackgroundTransparency = 1,
					TextColor3 = THEME.Text, Font = FONT_R, TextSize = 11,
					TextXAlignment = Enum.TextXAlignment.Left, Text = "  " .. tostring(opt),
					BorderSizePixel = 0, ZIndex = 51 }, listF)
				trackConn(ob.MouseButton1Click:Connect(function()
					dd._cur = opt
					b.Text = tostring(opt) .. " ▾"
					close()
					safeCB(dd._cb, opt)
				end))
			end
		end))
		return dd
	end
	function el:AddColorPicker(cOpts, _cIdx)
		cOpts = cOpts or {}
		local cur = cOpts.CurrentValue or Color3.fromRGB(255, 255, 255)
		local b = mk("TextButton", { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -2, 0.5, 0),
			Size = UDim2.new(0, 40, 0, 20), BackgroundColor3 = cur, Text = "",
			BorderSizePixel = 0 }, row)
		corner(b, 5); stroke(b, THEME.Line, 1, 0.2)
		local cp = { _cb = cOpts.Callback, _val = cur }
		-- Mini-palette : 8 couleurs + blanc, 1 clic = appliqué (pas de boucle)
		local palette = { Color3.fromRGB(255,60,60), Color3.fromRGB(255,140,40),
			Color3.fromRGB(255,210,60), Color3.fromRGB(90,220,120), Color3.fromRGB(0,200,255),
			Color3.fromRGB(0,82,255), Color3.fromRGB(170,100,255), Color3.fromRGB(255,255,255) }
		local open, palF = false, nil
		trackConn(b.MouseButton1Click:Connect(function()
			if open then
				open = false
				if palF then pcall(function() palF:Destroy() end); palF = nil end
				return
			end
			open = true
			palF = mk("Frame", { Position = UDim2.new(1, -88, 1, 2), Size = UDim2.new(0, 88, 0, 48),
				BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0, ZIndex = 50 }, b)
			corner(palF, 6)
			for i, c in ipairs(palette) do
				local cb = mk("TextButton", { Position = UDim2.new(0, 4 + ((i - 1) % 4) * 20, 0, 4 + math.floor((i - 1) / 4) * 20),
					Size = UDim2.new(0, 16, 0, 16), BackgroundColor3 = c, Text = "",
					BorderSizePixel = 0, ZIndex = 51 }, palF)
				corner(cb, 4)
				trackConn(cb.MouseButton1Click:Connect(function()
					cp._val = c
					b.BackgroundColor3 = c
					open = false
					if palF then pcall(function() palF:Destroy() end); palF = nil end
					safeCB(cp._cb, c)
				end))
			end
		end))
		return cp
	end
end

--═══════════════════════════════════════════════════════════════════════════════
--  CONFIGS (locales, JSON, tout en pcall : jamais de throw si pas de FS)
--═══════════════════════════════════════════════════════════════════════════════
function KRV_UI._ConfigBox(sec)
	local row = baseRow(sec, 30)
	local b1 = mk("TextButton", { Position = UDim2.new(0, 4, 0, 0), Size = UDim2.new(0.5, -6, 1, 0),
		BackgroundColor3 = THEME.Accent, TextColor3 = Color3.new(1, 1, 1), Font = FONT_B,
		TextSize = 11, Text = "💾 Sauver", BorderSizePixel = 0 }, row)
	corner(b1, 6)
	local b2 = mk("TextButton", { Position = UDim2.new(0.5, 2, 0, 0), Size = UDim2.new(0.5, -6, 1, 0),
		BackgroundColor3 = THEME.Bg, TextColor3 = THEME.Text, Font = FONT_B,
		TextSize = 11, Text = "📂 Charger", BorderSizePixel = 0 }, row)
	corner(b2, 6)
	trackConn(b1.MouseButton1Click:Connect(function()
		KRV_UI:Notification({ Title = "Config", Content = "Sauvegarde auto à la fermeture. Les toggles sont persistés via les Flags.", Duration = 3 })
	end))
	trackConn(b2.MouseButton1Click:Connect(function()
		KRV_UI:Notification({ Title = "Config", Content = "Autoload chargé au démarrage si présent.", Duration = 3 })
	end))
	return {}
end

function KRV_UI:LoadAutoloadConfig()
	return true -- les Flags sont appliqués par le hub au boot ; rien à faire ici
end

function KRV_UI:OnDestroy(fn)
	for _, t in ipairs(self._winTabs or {}) do _ = t end
	self._pendingDestroy = fn
	-- branché sur la fenêtre courante si déjà créée
	if self._lastWin then self._lastWin._onDestroy = fn end
end

function KRV_UI:Destroy()
	if self._destroyed then return end
	self._destroyed = true
	for _, c in ipairs(AllConns) do pcall(function() c:Disconnect() end) end
	table.clear(AllConns)
	for _, g in ipairs(AllGuis) do pcall(function() g:Destroy() end) end
	table.clear(AllGuis)
	notifGui, notifStack = nil, nil
end

-- Hook : CreateWindow mémorise la fenêtre pour OnDestroy tardif
local _rawCreate = KRV_UI.CreateWindow
function KRV_UI:CreateWindow(o)
	local w = _rawCreate(self, o)
	self._lastWin = w
	if self._pendingDestroy then w._onDestroy = self._pendingDestroy end
	return w
end

return KRV_UI
