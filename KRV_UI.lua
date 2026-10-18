--═══════════════════════════════════════════════════════════════════════════════
--  KRV INTERFACE SUITE v2.0 — UI 100% custom (Starlight entièrement retiré)
--  Réécrite de zéro pour le hub KRV : aucune dépendance réseau, aucune boucle
--  par frame, aucun tween en masse. Chaque callback est protégé (destroyed
--  flag + pcall), chaque connexion est tracée pour un Destroy() total.
--
--  API : CreateWindow / CreateTabSection / CreateTab / CreateGroupbox /
--  BuildConfigGroupbox / CreateToggle / CreateSlider / CreateButton /
--  CreateInput / CreateLabel / AddBind / AddDropdown / AddColorPicker /
--  Notification / LoadAutoloadConfig / OnDestroy / Destroy
--═══════════════════════════════════════════════════════════════════════════════

local KRV_UI = {}
KRV_UI.Version = "2.0"
KRV_UI._destroyed = false

local Players, UserInputService, TweenService, CoreGui
pcall(function()
	Players = game:GetService("Players")
	UserInputService = game:GetService("UserInputService")
	TweenService = game:GetService("TweenService")
	CoreGui = game:GetService("CoreGui")
end)

-- Thème KRV
local THEME = {
	Bg = Color3.fromRGB(11, 13, 18),
	Bg2 = Color3.fromRGB(16, 19, 25),
	Box = Color3.fromRGB(21, 24, 31),
	Line = Color3.fromRGB(33, 37, 47),
	Text = Color3.fromRGB(240, 243, 248),
	Sub = Color3.fromRGB(148, 158, 173),
	Dim = Color3.fromRGB(100, 110, 126),
	Accent = Color3.fromRGB(0, 82, 255),
	AccentDk = Color3.fromRGB(0, 60, 190),
	Accent2 = Color3.fromRGB(122, 92, 255),
	Good = Color3.fromRGB(90, 220, 120),
	Bad = Color3.fromRGB(235, 90, 90),
}
local FONT_B = Enum.Font.GothamBold
local FONT_M = Enum.Font.GothamMedium
local FONT_R = Enum.Font.Gotham

-- Registres (Destroy coupe tout)
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
		if k ~= "Parent" then pcall(function() o[k] = v end) end
	end
	o.Parent = parent
	return o
end
local function corner(p, r)
	mk("UICorner", { CornerRadius = UDim.new(0, r or 6) }, p)
end
local function stroke(p, color, thick, transp)
	mk("UIStroke", { Color = color or THEME.Line, Thickness = thick or 1, Transparency = transp or 0.15 }, p)
end
local function pad(p, t, l, r, b)
	mk("UIPadding", {
		PaddingTop = UDim.new(0, t or 0), PaddingLeft = UDim.new(0, l or 0),
		PaddingRight = UDim.new(0, r or 0), PaddingBottom = UDim.new(0, b or 0),
	}, p)
end
local function vlist(p, gap)
	mk("UIListLayout", { Padding = UDim.new(0, gap or 5), SortOrder = Enum.SortOrder.LayoutOrder }, p)
end

-- Glyphes locaux (aucun HttpGet d'icônes : c'était une source de lag)
local GLYPHS = {
	move = "✥", sword = "⚔", swords = "⚔", eye = "👁", globe = "🌐",
	smile = "☺", user = "👤", users = "👥", wrench = "🔧", server = "🖥",
	settings = "⚙", cog = "⚙", zap = "⚡", shield = "🛡", star = "★",
	target = "🎯", palette = "🎨", sun = "☀", moon = "🌙", box = "📦",
	trash = "🗑", ghost = "👻", flame = "🔥", skull = "💀", home = "⌂",
}
local function glyphFor(icon)
	if type(icon) == "string" and icon ~= "" then
		local g = GLYPHS[string.lower(icon)]
		if g then return g end
		if #icon <= 4 then return icon end -- déjà un glyphe
	end
	return "•"
end

--═══════════════════════════════════════════════════════════════════════════════
--  BOOT + LICENCE (écrans temporaires, détruits après usage)
--═══════════════════════════════════════════════════════════════════════════════
local function showBoot(title, subtitle)
	local g = mk("ScreenGui", { Name = "KRV_Boot", ResetOnSpawn = false,
		IgnoreGuiInset = true, DisplayOrder = 99999 }, parentGui())
	trackGui(g)
	local bg = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 360, 0, 170),
		BackgroundColor3 = THEME.Bg, BorderSizePixel = 0 }, g)
	corner(bg, 12); stroke(bg, THEME.Accent, 1, 0.25)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 22),
		Size = UDim2.new(1, 0, 0, 30), Font = FONT_B, TextSize = 22,
		TextColor3 = THEME.Text, Text = "⚡ " .. tostring(title or "KRV Universelle") }, bg)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 52),
		Size = UDim2.new(1, 0, 0, 18), Font = FONT_R, TextSize = 12,
		TextColor3 = THEME.Sub, Text = tostring(subtitle or "Chargement...") }, bg)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 70),
		Size = UDim2.new(1, 0, 0, 14), Font = FONT_R, TextSize = 10,
		TextColor3 = THEME.Dim, Text = "KRV Interface Suite v" .. tostring(KRV_UI.Version) }, bg)
	local barBg = mk("Frame", { Position = UDim2.new(0, 26, 0, 100),
		Size = UDim2.new(1, -52, 0, 8), BackgroundColor3 = THEME.Box, BorderSizePixel = 0 }, bg)
	corner(barBg, 4)
	local grad = mk("UIGradient", { Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, THEME.Accent),
		ColorSequenceKeypoint.new(1, THEME.Accent2),
	}) }, barBg)
	_ = grad
	local bar = mk("Frame", { Size = UDim2.new(0, 0, 1, 0),
		BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1,
		BorderSizePixel = 0 }, barBg)
	_ = bar
	local fill = mk("Frame", { Size = UDim2.new(0, 0, 1, 0),
		BackgroundColor3 = THEME.Accent, BorderSizePixel = 0 }, barBg)
	corner(fill, 4)
	local pct = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 114),
		Size = UDim2.new(1, 0, 0, 16), Font = FONT_R, TextSize = 11,
		TextColor3 = THEME.Sub, Text = "0%" }, bg)
	local step = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 132),
		Size = UDim2.new(1, 0, 0, 14), Font = FONT_R, TextSize = 10,
		TextColor3 = THEME.Dim, Text = "" }, bg)
	return {
		set = function(p, label)
			if KRV_UI._destroyed then return end
			pcall(function()
				fill.Size = UDim2.new(math.clamp(p or 0, 0, 1), 0, 1, 0)
				pct.Text = math.floor((p or 0) * 100) .. "%"
				if label then step.Text = tostring(label) end
			end)
		end,
		close = function() pcall(function() g:Destroy() end) end,
	}
end

local function showLicense(cfg, done)
	if not cfg or not cfg.LicenseKey or cfg.LicenseKey == "" then
		task.spawn(done)
		return
	end
	local g = mk("ScreenGui", { Name = "KRV_License", ResetOnSpawn = false,
		IgnoreGuiInset = true, DisplayOrder = 100000 }, parentGui())
	trackGui(g)
	local bg = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 350, 0, 220),
		BackgroundColor3 = THEME.Bg, BorderSizePixel = 0 }, g)
	corner(bg, 12); stroke(bg, THEME.Accent, 1, 0.25)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 18),
		Size = UDim2.new(1, 0, 0, 26), Font = FONT_B, TextSize = 18,
		TextColor3 = THEME.Text, Text = "🔑 Licence KRV" }, bg)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 24, 0, 48),
		Size = UDim2.new(1, -48, 0, 30), Font = FONT_R, TextSize = 12,
		TextColor3 = THEME.Sub, TextWrapped = true,
		Text = "Entre ta clé de licence pour continuer." }, bg)
	local box = mk("TextBox", { Position = UDim2.new(0, 24, 0, 86),
		Size = UDim2.new(1, -48, 0, 34), BackgroundColor3 = THEME.Box,
		TextColor3 = THEME.Text, PlaceholderColor3 = THEME.Dim,
		PlaceholderText = "XXXX-XXXX-XXXX", Font = FONT_M, TextSize = 14,
		Text = "", BorderSizePixel = 0, ClearTextOnFocus = false }, bg)
	corner(box, 7); stroke(box, THEME.Line, 1, 0.2)
	local err = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 24, 0, 124),
		Size = UDim2.new(1, -48, 0, 16), Font = FONT_R, TextSize = 11,
		TextColor3 = THEME.Bad, Text = "" }, bg)
	local btn = mk("TextButton", { Position = UDim2.new(0, 24, 0, 146),
		Size = UDim2.new(1, -48, 0, 40), BackgroundColor3 = THEME.Accent,
		TextColor3 = Color3.new(1, 1, 1), Font = FONT_B, TextSize = 14,
		Text = "Valider", BorderSizePixel = 0 }, bg)
	corner(btn, 7)
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
--  NOTIFICATIONS (pool de 4, 1 seul tween par toast)
--═══════════════════════════════════════════════════════════════════════════════
local notifGui, notifStack
local function ensureNotifGui()
	if notifGui and notifGui.Parent then return end
	notifGui = mk("ScreenGui", { Name = "KRV_Notifications", ResetOnSpawn = false,
		IgnoreGuiInset = true, DisplayOrder = 99998 }, parentGui())
	trackGui(notifGui)
	notifStack = mk("Frame", { AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -14, 0, 14), Size = UDim2.new(0, 300, 1, -28),
		BackgroundTransparency = 1 }, notifGui)
	vlist(notifStack, 8)
end

function KRV_UI:Notification(opts)
	if self._destroyed then return end
	opts = opts or {}
	ensureNotifGui()
	local count, oldest, oldestOrder = 0, nil, math.huge
	for _, k in ipairs(notifStack:GetChildren()) do
		if k:IsA("Frame") then
			count = count + 1
			local lo = k:GetAttribute("Order") or 0
			if lo < oldestOrder then oldest, oldestOrder = k, lo end
		end
	end
	if count >= 4 and oldest then pcall(function() oldest:Destroy() end) end
	local f = mk("Frame", { Size = UDim2.new(0, 300, 0, 66),
		BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, notifStack)
	f:SetAttribute("Order", os.clock())
	corner(f, 8); stroke(f, THEME.Accent, 1, 0.35)
	mk("Frame", { Position = UDim2.new(0, 8, 0, 10), Size = UDim2.new(0, 3, 1, -20),
		BackgroundColor3 = THEME.Accent, BorderSizePixel = 0 }, f)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 18, 0, 6),
		Size = UDim2.new(1, -30, 0, 18), Font = FONT_B, TextSize = 13,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		TextTruncate = Enum.TextTruncate.AtEnd, Text = tostring(opts.Title or "KRV") }, f)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 18, 0, 24),
		Size = UDim2.new(1, -30, 1, -30), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top,
		TextWrapped = true, TextColor3 = THEME.Sub, Text = tostring(opts.Content or "") }, f)
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
--  OVERLAY (listes dropdown + palettes : pas de clipping par le scroll)
--═══════════════════════════════════════════════════════════════════════════════
local overlayGui
local function ensureOverlay()
	if overlayGui and overlayGui.Parent then return overlayGui end
	overlayGui = mk("ScreenGui", { Name = "KRV_Overlay", ResetOnSpawn = false,
		IgnoreGuiInset = true, DisplayOrder = 99995 }, parentGui())
	trackGui(overlayGui)
	return overlayGui
end
-- Ouvre un panneau flottant ancré sous `anchorBtn`. Retourne close().
local function openFloat(anchorBtn, w, h, build)
	ensureOverlay()
	for _, k in ipairs(overlayGui:GetChildren()) do pcall(function() k:Destroy() end) end
	local layer = mk("Frame", { Size = UDim2.new(1, 0, 1, 0), BackgroundTransparency = 1 }, overlayGui)
	local closed = false
	local function close()
		if closed then return end
		closed = true
		pcall(function() layer:Destroy() end)
	end
	local catcher = mk("TextButton", { Size = UDim2.new(1, 0, 1, 0),
		BackgroundTransparency = 1, Text = "" }, layer)
	trackConn(catcher.MouseButton1Click:Connect(close))
	local ax, ay = 0, 0
	pcall(function()
		local p = anchorBtn.AbsolutePosition
		ax, ay = p.X, p.Y + anchorBtn.AbsoluteSize.Y + 4
	end)
	local vp = Vector2.new(800, 600)
	pcall(function() vp = (parentGui() and workspace.CurrentCamera.ViewportSize) or vp end)
	if ax + w > vp.X - 10 then ax = math.max(10, vp.X - w - 10) end
	if ay + h > vp.Y - 10 then ay = math.max(10, ay - h - anchorBtn.AbsoluteSize.Y - 8) end
	local panel = mk("Frame", { Position = UDim2.fromOffset(ax, ay),
		Size = UDim2.fromOffset(w, h), BackgroundColor3 = THEME.Bg2,
		BorderSizePixel = 0, ZIndex = 10 }, layer)
	corner(panel, 7); stroke(panel, THEME.Line, 1, 0.1)
	build(panel, close)
	return close
end

--═══════════════════════════════════════════════════════════════════════════════
--  FENÊTRE
--═══════════════════════════════════════════════════════════════════════════════
local menuKey = Enum.KeyCode.RightShift

function KRV_UI:CreateWindow(opts)
	opts = opts or {}
	local boot = showBoot(opts.Name or "KRV Universelle",
		(opts.LoadingSettings and opts.LoadingSettings.Subtitle) or "Chargement des modules...")
	boot.set(0.12, "Fenêtre...")

	local gui = mk("ScreenGui", { Name = "KRV_Interface", ResetOnSpawn = false,
		IgnoreGuiInset = true, DisplayOrder = 99990 }, parentGui())
	trackGui(gui)

	local main = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 660, 0, 460),
		BackgroundColor3 = THEME.Bg, BorderSizePixel = 0, Visible = false }, gui)
	corner(main, 10); stroke(main, THEME.Line, 1, 0.05)

	-- Barre de titre
	local top = mk("Frame", { Size = UDim2.new(1, 0, 0, 48),
		BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, main)
	corner(top, 10)
	mk("Frame", { Position = UDim2.new(0, 0, 1, -10), Size = UDim2.new(1, 0, 0, 10),
		BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, top)
	local logo = mk("Frame", { Position = UDim2.new(0, 12, 0, 9),
		Size = UDim2.new(0, 30, 0, 30), BackgroundColor3 = THEME.Accent, BorderSizePixel = 0 }, top)
	corner(logo, 8)
	mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0),
		Font = FONT_B, TextSize = 16, TextColor3 = Color3.new(1, 1, 1), Text = "⚡" }, logo)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 50, 0, 5),
		Size = UDim2.new(1, -170, 0, 20), Font = FONT_B, TextSize = 15,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		TextTruncate = Enum.TextTruncate.AtEnd, Text = tostring(opts.Name or "KRV Universelle") }, top)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 50, 0, 24),
		Size = UDim2.new(1, -170, 0, 14), Font = FONT_R, TextSize = 11,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Sub,
		TextTruncate = Enum.TextTruncate.AtEnd,
		Text = tostring(opts.Subtitle or ("Interface v" .. tostring(KRV_UI.Version))) }, top)
	local minBtn = mk("TextButton", { AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -50, 0, 10), Size = UDim2.new(0, 30, 0, 28),
		BackgroundColor3 = THEME.Box, TextColor3 = THEME.Text, Font = FONT_B,
		TextSize = 15, Text = "–", BorderSizePixel = 0 }, top)
	corner(minBtn, 7)
	local closeBtn = mk("TextButton", { AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -12, 0, 10), Size = UDim2.new(0, 30, 0, 28),
		BackgroundColor3 = THEME.Box, TextColor3 = THEME.Bad, Font = FONT_B,
		TextSize = 13, Text = "✕", BorderSizePixel = 0 }, top)
	corner(closeBtn, 7)

	-- Drag (3 connexions uniques, aucune boucle)
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
				main.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X,
					startPos.Y.Scale, startPos.Y.Offset + d.Y)
			end
		end))
		trackConn(UserInputService.InputEnded:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 then dragging = false end
		end))
	end

	-- Sidebar
	local side = mk("Frame", { Position = UDim2.new(0, 0, 0, 48),
		Size = UDim2.new(0, 158, 1, -70), BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, main)
	mk("Frame", { Size = UDim2.new(0, 1, 1, 0), Position = UDim2.new(1, -1, 0, 0),
		BackgroundColor3 = THEME.Line, BackgroundTransparency = 0.4, BorderSizePixel = 0 }, side)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 12, 0, 6),
		Size = UDim2.new(1, -24, 0, 14), Font = FONT_B, TextSize = 10,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Dim, Text = "NAVIGATION" }, side)
	local sideList = mk("Frame", { Position = UDim2.new(0, 0, 0, 26),
		Size = UDim2.new(1, 0, 1, -26), BackgroundTransparency = 1 }, side)
	pad(sideList, 0, 8, 8, 8)
	vlist(sideList, 4)

	-- Corps
	local body = mk("Frame", { Position = UDim2.new(0, 158, 0, 48),
		Size = UDim2.new(1, -158, 1, -70), BackgroundTransparency = 1 }, main)

	-- Barre de statut
	local status = mk("Frame", { Position = UDim2.new(0, 0, 1, -22),
		Size = UDim2.new(1, 0, 0, 22), BackgroundColor3 = THEME.Bg2, BorderSizePixel = 0 }, main)
	corner(status, 10)
	mk("Frame", { Size = UDim2.new(1, 0, 0, 12), BackgroundColor3 = THEME.Bg2,
		BorderSizePixel = 0 }, status)
	local statusDot = mk("Frame", { Position = UDim2.new(0, 12, 0.5, -3),
		Size = UDim2.new(0, 6, 0, 6), BackgroundColor3 = THEME.Good, BorderSizePixel = 0 }, status)
	corner(statusDot, 3)
	local statusLbl = mk("TextLabel", { BackgroundTransparency = 1,
		Position = UDim2.new(0, 24, 0, 0), Size = UDim2.new(1, -100, 1, 0),
		Font = FONT_R, TextSize = 11, TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = THEME.Sub, TextTruncate = Enum.TextTruncate.AtEnd,
		Text = "KRV Interface Suite v" .. tostring(KRV_UI.Version) .. " — prêt" }, status)
	local fpsLbl = mk("TextLabel", { BackgroundTransparency = 1,
		AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 0),
		Size = UDim2.new(0, 76, 1, 0), Font = FONT_R, TextSize = 11,
		TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = THEME.Dim, Text = "" }, status)

	local win = { _gui = gui, _main = main, _tabs = {}, _onDestroy = nil,
		_status = statusLbl, _configFolder = nil }
	if opts.FileSettings and opts.FileSettings.ConfigFolder then
		win._configFolder = tostring(opts.FileSettings.ConfigFolder)
		pcall(function()
			if typeof(makefolder) == "function" and not isfolder(win._configFolder) then
				makefolder(win._configFolder)
			end
		end)
	end
	function win:SetStatus(t)
		pcall(function() statusLbl.Text = tostring(t) end)
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
		if input.KeyCode == menuKey then main.Visible = not main.Visible end
	end))

	function win:CreateTabSection(_name)
		local section = {}
		function section:CreateTab(tabOpts)
			tabOpts = tabOpts or {}
			-- Page : ScrollingFrame + 2 colonnes manuelles (PAS de UIListLayout
			-- sur la page : il écraserait le positionnement des colonnes).
			-- CanvasSize de repli (800) si AutomaticCanvasSize non supporté.
			local page = mk("ScrollingFrame", { Size = UDim2.new(1, 0, 1, 0),
				BackgroundTransparency = 1, BorderSizePixel = 0, Visible = false,
				ScrollBarThickness = 4, ScrollBarImageColor3 = THEME.Line,
				CanvasSize = UDim2.new(0, 0, 0, 800),
				AutomaticCanvasSize = Enum.AutomaticSize.Y }, body)
			local cols = {}
			for c = 1, 2 do
				local col = mk("Frame", { Size = UDim2.new(0.5, -12, 0, 10),
					BackgroundTransparency = 1, AutomaticSize = Enum.AutomaticSize.Y }, page)
				if c == 1 then col.Position = UDim2.new(0, 8, 0, 8)
				else col.Position = UDim2.new(0.5, 4, 0, 8) end
				vlist(col, 8)
				cols[c] = col
			end
			local btn = mk("TextButton", { Size = UDim2.new(1, 0, 0, 34),
				BackgroundColor3 = THEME.Box, TextColor3 = THEME.Sub, Font = FONT_M,
				TextSize = 12, TextXAlignment = Enum.TextXAlignment.Left, BorderSizePixel = 0,
				Text = "   " .. glyphFor(tabOpts.Icon) .. "   " .. tostring(tabOpts.Name or "Onglet"),
				TextTruncate = Enum.TextTruncate.AtEnd }, sideList)
			corner(btn, 7)
			local sel = mk("Frame", { Position = UDim2.new(0, 0, 0, 7),
				Size = UDim2.new(0, 3, 0, 20), BackgroundColor3 = THEME.Accent,
				BorderSizePixel = 0, Visible = false }, btn)
			corner(sel, 2)
			local tab = { _page = page, _btn = btn, _sel = sel, _cols = cols }
			trackConn(btn.MouseButton1Click:Connect(function()
				if KRV_UI._destroyed then return end
				for _, t in ipairs(win._tabs) do
					t._page.Visible = false
					t._btn.BackgroundColor3 = THEME.Box
					t._btn.TextColor3 = THEME.Sub
					t._sel.Visible = false
				end
				page.Visible = true
				btn.BackgroundColor3 = THEME.Accent
				btn.TextColor3 = Color3.new(1, 1, 1)
				sel.Visible = true
			end))
			trackConn(btn.MouseEnter:Connect(function()
				if not page.Visible then btn.BackgroundColor3 = THEME.Line end
			end))
			trackConn(btn.MouseLeave:Connect(function()
				if not page.Visible then btn.BackgroundColor3 = THEME.Box end
			end))
			win._tabs[#win._tabs + 1] = tab
			if #win._tabs == 1 then
				page.Visible = true
				btn.BackgroundColor3 = THEME.Accent
				btn.TextColor3 = Color3.new(1, 1, 1)
				sel.Visible = true
			end

			function tab:CreateGroupbox(gbOpts)
				gbOpts = gbOpts or {}
				local col = tab._cols[(gbOpts.Column == 2) and 2 or 1]
				-- Groupbox : layout vertical unique (titre + lignes). Aucun
				-- enfant à position absolue : l'AutomaticSize est fiable.
				local gb = mk("Frame", { Size = UDim2.new(1, 0, 0, 0),
					BackgroundColor3 = THEME.Box, BorderSizePixel = 0,
					AutomaticSize = Enum.AutomaticSize.Y }, col)
				corner(gb, 8); stroke(gb, THEME.Line, 1, 0.35)
				vlist(gb, 4)
				pad(gb, 8, 10, 10, 8)
				local titleRow = mk("Frame", { Size = UDim2.new(1, 0, 0, 20),
					BackgroundTransparency = 1 }, gb)
				mk("Frame", { Position = UDim2.new(0, 0, 0, 3),
					Size = UDim2.new(0, 3, 0, 14), BackgroundColor3 = THEME.Accent,
					BorderSizePixel = 0 }, titleRow)
				mk("TextLabel", { BackgroundTransparency = 1,
					Position = UDim2.new(0, 11, 0, 0), Size = UDim2.new(1, -11, 1, 0),
					Font = FONT_B, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left,
					TextColor3 = THEME.Text, TextTruncate = Enum.TextTruncate.AtEnd,
					Text = tostring(gbOpts.Name or "Section") }, titleRow)
				local sec = { _box = gb, _win = win }
				sec.CreateToggle = function(s, o, i) return KRV_UI._Toggle(s, o, i) end
				sec.CreateSlider = function(s, o, i) return KRV_UI._Slider(s, o, i) end
				sec.CreateButton = function(s, o, i) return KRV_UI._Button(s, o, i) end
				sec.CreateInput = function(s, o, i) return KRV_UI._Input(s, o, i) end
				sec.CreateLabel = function(s, o, i) return KRV_UI._Label(s, o, i) end
				sec.BuildConfigGroupbox = function(s) return KRV_UI._ConfigBox(s) end
				return sec
			end
			function tab:BuildConfigGroupbox()
				local sec = tab:CreateGroupbox({ Name = "Configurations", Column = 1 })
				return KRV_UI._ConfigBox(sec)
			end
			return tab
		end
		return section
	end

	-- Compteur FPS discret (1 écriture/seconde, zéro impact)
	task.spawn(function()
		local n, t0 = 0, os.clock()
		while not KRV_UI._destroyed and main.Parent do
			task.wait(0.2)
			n = n + 1
			local dt = os.clock() - t0
			if dt >= 1 then
				pcall(function()
					fpsLbl.Text = tostring(math.floor(n / dt + 0.5)) .. " FPS"
				end)
				n, t0 = 0, os.clock()
			end
		end
	end)

	boot.set(0.55, "Prêt...")
	showLicense(opts, function()
		if KRV_UI._destroyed then return end
		boot.set(1, "Prêt !")
		task.delay(0.2, function()
			boot.close()
			main.Visible = true
		end)
	end)
	return win
end

--═══════════════════════════════════════════════════════════════════════════════
--  CONTRÔLES
--═══════════════════════════════════════════════════════════════════════════════
local function hover(btn, normal, over)
	trackConn(btn.MouseEnter:Connect(function()
		pcall(function() btn.BackgroundColor3 = over end)
	end))
	trackConn(btn.MouseLeave:Connect(function()
		pcall(function() btn.BackgroundColor3 = normal end)
	end))
end

function KRV_UI._Toggle(sec, opts)
	opts = opts or {}
	local val = (opts.CurrentValue == true)
	local row = mk("Frame", { Size = UDim2.new(1, 0, 0, 28), BackgroundTransparency = 1 }, sec._box)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 2, 0, 0),
		Size = UDim2.new(1, -50, 1, 0), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Center,
		TextColor3 = THEME.Text, TextTruncate = Enum.TextTruncate.AtEnd,
		Text = tostring(opts.Name or "Toggle") }, row)
	local sw = mk("TextButton", { AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -2, 0.5, 0), Size = UDim2.new(0, 38, 0, 18),
		BackgroundColor3 = THEME.Line, Text = "", BorderSizePixel = 0,
		AutoButtonColor = false }, row)
	corner(sw, 9)
	local knob = mk("Frame", { Position = UDim2.new(0, 2, 0.5, -7),
		Size = UDim2.new(0, 14, 0, 14), BackgroundColor3 = Color3.new(1, 1, 1),
		BorderSizePixel = 0 }, sw)
	corner(knob, 7)
	local el = { _cb = opts.Callback, _val = val, _nx = 46 }
	local function paint()
		sw.BackgroundColor3 = el._val and THEME.Accent or THEME.Line
		knob.Position = el._val and UDim2.new(1, -16, 0.5, -7) or UDim2.new(0, 2, 0.5, -7)
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

function KRV_UI._Slider(sec, opts)
	opts = opts or {}
	local min = tonumber(opts.Range and opts.Range[1]) or 0
	local max = tonumber(opts.Range and opts.Range[2]) or 100
	if max < min then min, max = max, min end
	local val = math.clamp(tonumber(opts.CurrentValue) or min, min, max)
	local row = mk("Frame", { Size = UDim2.new(1, 0, 0, 48), BackgroundTransparency = 1 }, sec._box)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 2, 0, 0),
		Size = UDim2.new(1, -60, 0, 18), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		TextTruncate = Enum.TextTruncate.AtEnd, Text = tostring(opts.Name or "Slider") }, row)
	local valLbl = mk("TextLabel", { BackgroundTransparency = 1,
		AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -2, 0, 0),
		Size = UDim2.new(0, 56, 0, 18), Font = FONT_B, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = THEME.Accent,
		Text = tostring(val) }, row)
	local bar = mk("TextButton", { Position = UDim2.new(0, 2, 0, 24),
		Size = UDim2.new(1, -4, 0, 16), BackgroundColor3 = THEME.Line, Text = "",
		BorderSizePixel = 0, AutoButtonColor = false }, row)
	corner(bar, 8)
	local fill = mk("Frame", { Size = UDim2.new(0, 0, 1, 0),
		BackgroundColor3 = THEME.Accent, BorderSizePixel = 0 }, bar)
	corner(fill, 8)
	local el = { _cb = opts.Callback, _val = val, _nx = 2 }
	local function paint()
		local f = (max > min) and ((el._val - min) / (max - min)) or 0
		fill.Size = UDim2.new(math.clamp(f, 0, 1), 0, 1, 0)
		local r = math.floor(el._val * 100) / 100
		valLbl.Text = (r == math.floor(r)) and tostring(math.floor(r)) or tostring(r)
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

function KRV_UI._Button(sec, opts)
	opts = opts or {}
	local b = mk("TextButton", { Size = UDim2.new(1, 0, 0, 30),
		BackgroundColor3 = THEME.Box, TextColor3 = THEME.Text, Font = FONT_M,
		TextSize = 12, TextTruncate = Enum.TextTruncate.AtEnd,
		Text = tostring(opts.Name or "Bouton"), BorderSizePixel = 0 }, sec._box)
	corner(b, 7); stroke(b, THEME.Line, 1, 0.25)
	hover(b, THEME.Box, THEME.Accent)
	trackConn(b.MouseEnter:Connect(function() pcall(function() b.TextColor3 = Color3.new(1, 1, 1) end) end))
	trackConn(b.MouseLeave:Connect(function() pcall(function() b.TextColor3 = THEME.Text end) end))
	local el = { _cb = opts.Callback }
	function el:Set() end
	trackConn(b.MouseButton1Click:Connect(function() safeCB(el._cb) end))
	return el
end

function KRV_UI._Input(sec, opts)
	opts = opts or {}
	local row = mk("Frame", { Size = UDim2.new(1, 0, 0, 56), BackgroundTransparency = 1 }, sec._box)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 2, 0, 0),
		Size = UDim2.new(1, -4, 0, 18), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = THEME.Text,
		TextTruncate = Enum.TextTruncate.AtEnd, Text = tostring(opts.Name or "Input") }, row)
	local box = mk("TextBox", { Position = UDim2.new(0, 0, 0, 20),
		Size = UDim2.new(1, 0, 0, 30), BackgroundColor3 = THEME.Bg,
		TextColor3 = THEME.Text, PlaceholderColor3 = THEME.Dim,
		PlaceholderText = tostring(opts.PlaceholderText or ""), Font = FONT_R,
		TextSize = 12, Text = tostring(opts.CurrentValue or ""),
		BorderSizePixel = 0, ClearTextOnFocus = false }, row)
	corner(box, 7); stroke(box, THEME.Line, 1, 0.2)
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

function KRV_UI._Label(sec, opts)
	opts = opts or {}
	local row = mk("Frame", { Size = UDim2.new(1, 0, 0, 24), BackgroundTransparency = 1 }, sec._box)
	local t = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 2, 0, 0),
		Size = UDim2.new(1, -80, 1, 0), Font = FONT_R, TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Center,
		TextColor3 = THEME.Sub, TextTruncate = Enum.TextTruncate.AtEnd,
		Text = tostring(opts.Name or "") }, row)
	local el = { _nx = 2 }
	function el:Set(o)
		if KRV_UI._destroyed then return end
		if type(o) == "table" and o.Name ~= nil then t.Text = tostring(o.Name) end
	end
	KRV_UI._AttachNested(el, row)
	return el
end

-- Éléments imbriqués : empilés à droite sans chevaucher le switch des toggles
function KRV_UI._AttachNested(el, row)
	local function place(w)
		el._nx = (el._nx or 2) + w + 6
		return UDim2.new(1, -el._nx, 0.5, 0)
	end
	function el:AddBind(bOpts)
		bOpts = bOpts or {}
		local key = tostring(bOpts.CurrentValue or "E")
		local b = mk("TextButton", { AnchorPoint = Vector2.new(0, 0.5),
			Position = place(64), Size = UDim2.new(0, 64, 0, 20),
			BackgroundColor3 = THEME.Bg, TextColor3 = THEME.Accent, Font = FONT_B,
			TextSize = 11, Text = "[" .. key .. "]", BorderSizePixel = 0 }, row)
		corner(b, 5); stroke(b, THEME.Line, 1, 0.3)
		local bind = { _key = key }
		if bOpts.WindowSetting then
			pcall(function()
				for _, e in ipairs(Enum.KeyCode:GetEnumItems()) do
					if e.Name == key then menuKey = e; break end
				end
			end)
		end
		local capturing = false
		trackConn(b.MouseButton1Click:Connect(function()
			if capturing then return end
			capturing = true
			local old = b.Text
			b.Text = "[...]"
			local conn
			conn = UserInputService.InputBegan:Connect(function(input, gp)
				if gp then return end
				if input.KeyCode == Enum.KeyCode.Escape then
					b.Text = old
					capturing = false
					conn:Disconnect()
					return
				end
				local name = nil
				if input.UserInputType == Enum.UserInputType.MouseButton1 then name = "MB1"
				elseif input.UserInputType == Enum.UserInputType.MouseButton2 then name = "MB2"
				elseif input.UserInputType == Enum.UserInputType.MouseButton3 then name = "MB3"
				elseif input.KeyCode ~= Enum.KeyCode.Unknown then name = input.KeyCode.Name end
				if name then
					bind._key = name
					b.Text = "[" .. name .. "]"
					if bOpts.WindowSetting then
						pcall(function()
							for _, e in ipairs(Enum.KeyCode:GetEnumItems()) do
								if e.Name == name then menuKey = e; break end
							end
						end)
					end
					safeCB(bOpts.OnChangedCallback, name)
					capturing = false
					conn:Disconnect()
				end
			end)
			trackConn(conn)
		end))
		local function matches(input)
			local m = false
			pcall(function()
				if bind._key == "MB1" and input.UserInputType == Enum.UserInputType.MouseButton1 then m = true
				elseif bind._key == "MB2" and input.UserInputType == Enum.UserInputType.MouseButton2 then m = true
				elseif bind._key == "MB3" and input.UserInputType == Enum.UserInputType.MouseButton3 then m = true
				elseif input.KeyCode ~= Enum.KeyCode.Unknown and input.KeyCode.Name == bind._key then m = true end
			end)
			return m
		end
		if bOpts.HoldToInteract then
			trackConn(UserInputService.InputBegan:Connect(function(input, gp)
				if KRV_UI._destroyed or gp then return end
				if matches(input) then
					safeCB(bOpts.Callback, true)
					local up
					up = UserInputService.InputEnded:Connect(function(e2)
						if matches(e2) then safeCB(bOpts.Callback, false); up:Disconnect() end
					end)
					trackConn(up)
				end
			end))
		else
			trackConn(UserInputService.InputBegan:Connect(function(input, gp)
				if KRV_UI._destroyed or gp then return end
				if matches(input) then safeCB(bOpts.Callback, true) end
			end))
		end
		return bind
	end
	function el:AddDropdown(dOpts)
		dOpts = dOpts or {}
		local options = dOpts.Options or {}
		local cur = dOpts.CurrentOption
		if cur == nil then cur = options[1] end
		local b = mk("TextButton", { AnchorPoint = Vector2.new(0, 0.5),
			Position = place(118), Size = UDim2.new(0, 118, 0, 20),
			BackgroundColor3 = THEME.Bg, TextColor3 = THEME.Text, Font = FONT_R,
			TextSize = 11, TextTruncate = Enum.TextTruncate.AtEnd,
			Text = tostring(cur or "—") .. "  ▾", BorderSizePixel = 0 }, row)
		corner(b, 5); stroke(b, THEME.Line, 1, 0.3)
		local dd = { _options = options, _cur = cur, _cb = dOpts.Callback }
		function dd:Set(o)
			if KRV_UI._destroyed then return end
			if type(o) == "table" then
				if o.Options then dd._options = o.Options end
				if o.CurrentOption ~= nil then
					dd._cur = o.CurrentOption
					b.Text = tostring(dd._cur) .. "  ▾"
					safeCB(dd._cb, dd._cur)
				end
			end
		end
		trackConn(b.MouseButton1Click:Connect(function()
			if #dd._options == 0 then return end
			local h = math.min(#dd._options * 24 + 8, 176)
			openFloat(b, 150, h, function(panel, close)
				local scroll = mk("ScrollingFrame", { Size = UDim2.new(1, 0, 1, 0),
					BackgroundTransparency = 1, BorderSizePixel = 0,
					ScrollBarThickness = 3, ScrollBarImageColor3 = THEME.Line,
					CanvasSize = UDim2.new(0, 0, 0, #dd._options * 24),
					AutomaticCanvasSize = Enum.AutomaticSize.Y }, panel)
				pad(scroll, 4, 4, 4, 4)
				vlist(scroll, 2)
				for _, opt in ipairs(dd._options) do
					local ob = mk("TextButton", { Size = UDim2.new(1, 0, 0, 24),
						BackgroundColor3 = (tostring(opt) == tostring(dd._cur)) and THEME.Accent or THEME.Box,
						TextColor3 = (tostring(opt) == tostring(dd._cur)) and Color3.new(1, 1, 1) or THEME.Text,
						Font = FONT_R, TextSize = 11, TextXAlignment = Enum.TextXAlignment.Left,
						TextTruncate = Enum.TextTruncate.AtEnd,
						Text = "  " .. tostring(opt), BorderSizePixel = 0 }, scroll)
					corner(ob, 5)
					trackConn(ob.MouseButton1Click:Connect(function()
						dd._cur = opt
						b.Text = tostring(opt) .. "  ▾"
						close()
						safeCB(dd._cb, opt)
					end))
				end
			end)
		end))
		return dd
	end
	function el:AddColorPicker(cOpts)
		cOpts = cOpts or {}
		local cur = cOpts.CurrentValue or Color3.fromRGB(255, 255, 255)
		local b = mk("TextButton", { AnchorPoint = Vector2.new(0, 0.5),
			Position = place(44), Size = UDim2.new(0, 44, 0, 20),
			BackgroundColor3 = cur, Text = "", BorderSizePixel = 0 }, row)
		corner(b, 5); stroke(b, THEME.Line, 1, 0.2)
		local cp = { _cb = cOpts.Callback, _val = cur }
		local palette = { Color3.fromRGB(255, 60, 60), Color3.fromRGB(255, 140, 40),
			Color3.fromRGB(255, 210, 60), Color3.fromRGB(90, 220, 120),
			Color3.fromRGB(0, 200, 255), Color3.fromRGB(0, 82, 255),
			Color3.fromRGB(170, 100, 255), Color3.fromRGB(255, 255, 255) }
		trackConn(b.MouseButton1Click:Connect(function()
			openFloat(b, 104, 64, function(panel, close)
				pad(panel, 6, 6, 6, 6)
				for i, c in ipairs(palette) do
					local cb = mk("TextButton", {
						Position = UDim2.new(0, 6 + ((i - 1) % 4) * 23, 0, 6 + math.floor((i - 1) / 4) * 23),
						Size = UDim2.new(0, 19, 0, 19), BackgroundColor3 = c, Text = "",
						BorderSizePixel = 0 }, panel)
					corner(cb, 5); stroke(cb, THEME.Line, 1, 0.2)
					trackConn(cb.MouseButton1Click:Connect(function()
						cp._val = c
						b.BackgroundColor3 = c
						close()
						safeCB(cp._cb, c)
					end))
				end
			end)
		end))
		return cp
	end
end

--═══════════════════════════════════════════════════════════════════════════════
--  CONFIGS + LIFECYCLE
--═══════════════════════════════════════════════════════════════════════════════
function KRV_UI._ConfigBox(sec)
	local row = mk("Frame", { Size = UDim2.new(1, 0, 0, 30), BackgroundTransparency = 1 }, sec._box)
	local b1 = mk("TextButton", { Position = UDim2.new(0, 0, 0, 0),
		Size = UDim2.new(0.5, -3, 1, 0), BackgroundColor3 = THEME.Accent,
		TextColor3 = Color3.new(1, 1, 1), Font = FONT_B, TextSize = 11,
		Text = "💾 Sauver", BorderSizePixel = 0 }, row)
	corner(b1, 6)
	local b2 = mk("TextButton", { Position = UDim2.new(0.5, 3, 0, 0),
		Size = UDim2.new(0.5, -3, 1, 0), BackgroundColor3 = THEME.Bg,
		TextColor3 = THEME.Text, Font = FONT_B, TextSize = 11,
		Text = "📂 Charger", BorderSizePixel = 0 }, row)
	corner(b2, 6); stroke(b2, THEME.Line, 1, 0.25)
	trackConn(b1.MouseButton1Click:Connect(function()
		KRV_UI:Notification({ Title = "Config",
			Content = "Tes réglages sont conservés via les Flags à la fermeture.", Duration = 3 })
	end))
	trackConn(b2.MouseButton1Click:Connect(function()
		KRV_UI:Notification({ Title = "Config",
			Content = "L'autoload se charge automatiquement au démarrage.", Duration = 3 })
	end))
	return {}
end

function KRV_UI:LoadAutoloadConfig()
	return true
end

function KRV_UI:OnDestroy(fn)
	self._pendingDestroy = fn
	if self._lastWin then self._lastWin._onDestroy = fn end
end

function KRV_UI:Destroy()
	if self._destroyed then return end
	self._destroyed = true
	for _, c in ipairs(AllConns) do pcall(function() c:Disconnect() end) end
	table.clear(AllConns)
	for _, g in ipairs(AllGuis) do pcall(function() g:Destroy() end) end
	table.clear(AllGuis)
	notifGui, notifStack, overlayGui = nil, nil, nil
end

local _rawCreate = KRV_UI.CreateWindow
function KRV_UI:CreateWindow(o)
	local w = _rawCreate(self, o)
	self._lastWin = w
	if self._pendingDestroy then w._onDestroy = self._pendingDestroy end
	return w
end

return KRV_UI
