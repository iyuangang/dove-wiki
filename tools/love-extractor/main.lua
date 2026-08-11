local game_root = os.getenv("DOVE_GAME_DIR")
local raw_output = os.getenv("DOVE_RAW_OUTPUT")
local portrait_output = os.getenv("DOVE_PORTRAIT_DIR")
local encyclopedia_output = os.getenv("DOVE_ENCYCLOPEDIA_DIR")
local skill_icon_output = os.getenv("DOVE_SKILL_ICON_DIR")

local function fail(message)
	io.stderr:write("[dove-wiki] " .. message .. "\n")
	love.event.quit(1)
end

local function join_path(root, path)
	return (root:gsub("\\", "/")):gsub("/$", "") .. "/" .. path
end

local function install_game_loader(root_dir)
	local roots = {
		"",
		"lib",
		"all",
		"all-desktop",
		"kr1",
		"kr1-desktop",
		"_assets",
		"_assets/all-desktop",
		"_assets/kr1-desktop",
		"mods",
		"mods/all",
		"plugins"
	}
	local searchers = package.searchers or package.loaders

	table.insert(searchers, 1, function(module_name)
		local name = module_name:gsub("%.", "/")

		for _, root in ipairs(roots) do
			for _, suffix in ipairs({".lua", "/init.lua"}) do
				local relative_path = (root == "" and "" or root .. "/") .. name .. suffix
				local path = join_path(root_dir, relative_path)
				local handle = io.open(path, "rb")

				if handle then
					handle:close()
					local chunk, err = loadfile(path)

					if chunk then
						return chunk
					end

					return nil, err
				end
			end
		end

		return nil
	end)
end

local function json_escape(value)
	return value:gsub("[\\\"%z\1-\31]", function(char)
		local escapes = {
			["\\"] = "\\\\",
			["\""] = "\\\"",
			["\b"] = "\\b",
			["\f"] = "\\f",
			["\n"] = "\\n",
			["\r"] = "\\r",
			["\t"] = "\\t"
		}

		return escapes[char] or string.format("\\u%04x", char:byte())
	end)
end

local function json_encode(value, stack)
	local value_type = type(value)

	if value_type == "nil" then
		return "null"
	elseif value_type == "boolean" then
		return value and "true" or "false"
	elseif value_type == "number" then
		if value ~= value or value == math.huge or value == -math.huge then
			return "null"
		end

		return string.format("%.14g", value)
	elseif value_type == "string" then
		return "\"" .. json_escape(value) .. "\""
	elseif value_type ~= "table" then
		return "null"
	end

	stack = stack or {}
	if stack[value] then
		return "null"
	end
	stack[value] = true

	local count = 0
	local max_index = 0
	local is_array = true

	for key in pairs(value) do
		count = count + 1
		if type(key) ~= "number" or key < 1 or key % 1 ~= 0 then
			is_array = false
		else
			max_index = math.max(max_index, key)
		end
	end

	if is_array and max_index ~= count then
		is_array = false
	end

	local parts = {}
	if is_array then
		for index = 1, max_index do
			parts[#parts + 1] = json_encode(value[index], stack)
		end
		stack[value] = nil
		return "[" .. table.concat(parts, ",") .. "]"
	end

	local keys = {}
	for key in pairs(value) do
		if type(key) == "string" or type(key) == "number" then
			keys[#keys + 1] = key
		end
	end
	table.sort(keys, function(a, b)
		return tostring(a) < tostring(b)
	end)

	for _, key in ipairs(keys) do
		parts[#parts + 1] = json_encode(tostring(key), stack) .. ":" .. json_encode(value[key], stack)
	end

	stack[value] = nil
	return "{" .. table.concat(parts, ",") .. "}"
end

local function copy_jsonable(value, depth, seen)
	local value_type = type(value)

	if value_type == "string" or value_type == "number" or value_type == "boolean" then
		return value
	elseif value_type == "cdata" then
		local ok_x, x = pcall(function()
			return tonumber(value.x)
		end)
		local ok_y, y = pcall(function()
			return tonumber(value.y)
		end)

		if ok_x and ok_y and x and y then
			return {x = x, y = y}
		end

		return nil
	elseif value_type ~= "table" or depth <= 0 then
		return nil
	end

	seen = seen or {}
	if seen[value] then
		return nil
	end
	seen[value] = true

	local result = {}
	for key, item in pairs(value) do
		if type(key) == "string" or type(key) == "number" then
			local copied = copy_jsonable(item, depth - 1, seen)
			if copied ~= nil then
				result[key] = copied
			end
		end
	end

	seen[value] = nil
	return result
end

local reference_components = {
	"area_attack",
	"attacks",
	"aura",
	"barrack",
	"bullet",
	"count_group",
	"damage",
	"dps",
	"health",
	"melee",
	"modifier",
	"motion",
	"ranged",
	"soldier",
	"spawn",
	"spawner",
	"timed",
	"tower",
	"unit"
}

local function find_template_references(value, entities, output, depth, seen)
	if depth <= 0 then
		return
	end

	local value_type = type(value)
	if value_type == "string" then
		if entities[value] then
			output[value] = true
		end
		return
	elseif value_type ~= "table" then
		return
	end

	seen = seen or {}
	if seen[value] then
		return
	end
	seen[value] = true

	for _, item in pairs(value) do
		find_template_references(item, entities, output, depth - 1, seen)
	end

	seen[value] = nil
end

local function summarize_reference(template)
	local summary = {template_name = template.template_name}

	for _, component_name in ipairs(reference_components) do
		if template[component_name] ~= nil then
			summary[component_name] = copy_jsonable(template[component_name], 7)
		end
	end

	return summary
end

local function load_lua_table(path)
	local chunk, err = loadfile(join_path(game_root, path))
	if not chunk then
		error(err)
	end

	return chunk()
end

local function collect_menu_images(value, result, seen)
	if type(value) ~= "table" or seen[value] then
		return
	end

	seen[value] = true
	if type(value.action_arg) == "string" and type(value.image) == "string" then
		result[value.action_arg] = value.image
	end

	for _, child in pairs(value) do
		collect_menu_images(child, result, seen)
	end
end

local function load_encyclopedia_index()
	local path = join_path(game_root, "kr1-desktop/data/map_data.lua")
	local handle = assert(io.open(path, "rb"))
	local source = handle:read("*a")
	handle:close()

	local tower_data = assert(source:match("tower_data=(%b{})"), "map_data.lua is missing tower_data")
	local entries = {}
	local order = 0

	for item in tower_data:gmatch("{([^{}]+)}") do
		local tower_id = item:match('name="([^"]+)"')
		local icon = tonumber(item:match("icon=(%d+)"))
		local detail_icon = tonumber(item:match("detail_icon=(%d+)"))

		if tower_id and icon and detail_icon then
			order = order + 1
			local from_kr = tonumber(item:match("from_kr=(%d+)")) or 1
			local prefix = from_kr == 1 and "" or "kr" .. from_kr .. "_"

			entries[tower_id] = {
				order = order,
				from_kr = from_kr,
				icon = icon,
				detail_icon = detail_icon,
				thumb_sprite = prefix .. string.format("encyclopedia_tower_thumbs_%04i", icon),
				detail_sprite = prefix .. string.format("encyclopedia_towers_%04i", detail_icon)
			}
		end
	end

	return entries
end

local function build_raw_export(entity_db)
	local settings = require("game_settings")
	local localization = load_lua_table("_assets/kr1-desktop/strings/zh-Hans.lua")
	local i18n = require("i18n")
	i18n.msgs[i18n.current_locale] = localization
	local portrait_atlas = load_lua_table("_assets/kr1-desktop/images/fullhd/gui_portraits.lua")
	local gui_icon_atlas = load_lua_table("_assets/kr1-desktop/images/fullhd/gui_ico.lua")
	local encyclopedia_thumb_atlas = load_lua_table("_assets/kr1-desktop/images/fullhd/encyclopedia.lua")
	local encyclopedia_detail_atlas = load_lua_table("_assets/kr1-desktop/images/fullhd/encyclopedia_creeps.lua")
	local encyclopedia_index = load_encyclopedia_index()
	local tower_menus = require("data.tower_menus_data")
	local family_lists = {
		{name = "archer", towers = settings.archer_towers},
		{name = "mage", towers = settings.mage_towers},
		{name = "engineer", towers = settings.engineer_towers},
		{name = "barrack", towers = settings.barrack_towers}
	}
	local tower_order = {}
	local tower_families = {}

	for _, family_entry in ipairs(family_lists) do
		for _, tower_id in ipairs(family_entry.towers) do
			if not tower_families[tower_id] then
				tower_order[#tower_order + 1] = tower_id
				tower_families[tower_id] = {}
			end

			table.insert(tower_families[tower_id], family_entry.name)
		end
	end

	local towers = {}
	for _, tower_id in ipairs(tower_order) do
		local template = entity_db.entities[tower_id]
		local record = {
			id = tower_id,
			families = tower_families[tower_id],
			template_exists = template ~= nil
		}

		if template then
			record.template = {
				attacks = copy_jsonable(template.attacks, 8),
				barrack = copy_jsonable(template.barrack, 8),
				info = copy_jsonable(template.info, 4),
				powers = copy_jsonable(template.powers, 8),
				tower = copy_jsonable(template.tower, 5)
			}

			if template.info and type(template.info.fn) == "function" then
				local info_ok, computed_info = pcall(template.info.fn, template)
				if info_ok and type(computed_info) == "table" then
					record.computed_info = copy_jsonable(computed_info, 6)
				else
					record.computed_info_error = tostring(computed_info)
				end
			end

			record.power_icons = {}
			local menu_key = template.tower and template.tower.type
			local menu_images = {}
			collect_menu_images(tower_menus[menu_key], menu_images, {})

			for power_id in pairs(template.powers or {}) do
				local sprite = menu_images[power_id]
				if sprite and gui_icon_atlas[sprite] then
					record.power_icons[power_id] = {
						sprite = sprite,
						atlas = copy_jsonable(gui_icon_atlas[sprite], 4)
					}
				end
			end

			local reference_names = {}
			find_template_references(record.template.attacks, entity_db.entities, reference_names, 8)
			find_template_references(record.template.barrack, entity_db.entities, reference_names, 8)
			find_template_references(record.template.powers, entity_db.entities, reference_names, 8)

			record.references = {}
			local frontier = {}
			for reference_name in pairs(reference_names) do
				frontier[#frontier + 1] = {name = reference_name, depth = 1}
			end

			local visited = {}
			local cursor = 1
			while cursor <= #frontier do
				local item = frontier[cursor]
				cursor = cursor + 1

				if not visited[item.name] and item.name ~= tower_id and item.depth <= 3 then
					visited[item.name] = true
					local reference_template = entity_db.entities[item.name]

					if reference_template then
						local summary = summarize_reference(reference_template)
						record.references[item.name] = summary

						local nested_names = {}
						find_template_references(summary, entity_db.entities, nested_names, 8)
						for nested_name in pairs(nested_names) do
							if not visited[nested_name] then
								frontier[#frontier + 1] = {name = nested_name, depth = item.depth + 1}
							end
						end
					end
				end
			end

			local portrait_name = template.info and template.info.portrait
			if portrait_name and portrait_atlas[portrait_name] then
				record.portrait_atlas = copy_jsonable(portrait_atlas[portrait_name], 4)
			end
		end

		local encyclopedia = encyclopedia_index[tower_id]
		if encyclopedia then
			record.encyclopedia = copy_jsonable(encyclopedia, 4)
			record.encyclopedia.thumb_atlas = copy_jsonable(
				encyclopedia_thumb_atlas[encyclopedia.thumb_sprite],
				4
			)
			record.encyclopedia.detail_atlas = copy_jsonable(
				encyclopedia_detail_atlas[encyclopedia.detail_sprite],
				4
			)
		end

		towers[#towers + 1] = record
	end

	return {
		localization = localization,
		towers = towers
	}
end

local function export_atlas_crop(atlas, output_path, image_cache)
	if not atlas or not atlas.a_name or not atlas.f_quad or not atlas.size then
		error("missing atlas metadata for " .. output_path)
	end

	local image = image_cache[atlas.a_name]
	if not image then
		local atlas_path = join_path(game_root, "_assets/kr1-desktop/images/fullhd/" .. atlas.a_name)
		local input = assert(io.open(atlas_path, "rb"))
		local contents = input:read("*a")
		input:close()

		local file_data = love.filesystem.newFileData(contents, atlas.a_name)
		image = love.graphics.newImage(file_data)
		image:setFilter("nearest", "nearest")
		image_cache[atlas.a_name] = image
	end

	local x, y, width, height = unpack(atlas.f_quad)
	local canvas_width, canvas_height = unpack(atlas.size)
	local left = atlas.trim and atlas.trim[1] or 0
	local top = atlas.trim and atlas.trim[2] or 0
	local atlas_width = atlas.a_size and atlas.a_size[1] or image:getWidth()
	local atlas_height = atlas.a_size and atlas.a_size[2] or image:getHeight()
	local quad = love.graphics.newQuad(x, y, width, height, atlas_width, atlas_height)
	local canvas = love.graphics.newCanvas(canvas_width, canvas_height, {format = "rgba8"})

	love.graphics.push("all")
	love.graphics.setCanvas(canvas)
	love.graphics.clear(0, 0, 0, 0)
	love.graphics.setColor(1, 1, 1, 1)
	love.graphics.draw(image, quad, left, top)
	love.graphics.setCanvas()
	love.graphics.pop()

	local image_data = canvas:newImageData()
	local png_data = image_data:encode("png")
	local output = assert(io.open(output_path, "wb"))
	output:write(png_data:getString())
	output:close()

	quad:release()
	canvas:release()
	image_data:release()
	png_data:release()
end

local function export_portraits(towers)
	local image_cache = {}

	for index, tower in ipairs(towers) do
		export_atlas_crop(
			tower.portrait_atlas,
			join_path(portrait_output, tower.id .. ".png"),
			image_cache
		)

		if index % 20 == 0 or index == #towers then
			print(string.format("DOVE_WIKI_PORTRAITS=%d/%d", index, #towers))
		end
	end

	for _, image in pairs(image_cache) do
		image:release()
	end
end

local function export_encyclopedia_images(towers)
	local image_cache = {}
	local exported = 0

	for _, tower in ipairs(towers) do
		if tower.encyclopedia then
			export_atlas_crop(
				tower.encyclopedia.thumb_atlas,
				join_path(encyclopedia_output, "thumbs/" .. tower.id .. ".png"),
				image_cache
			)
			export_atlas_crop(
				tower.encyclopedia.detail_atlas,
				join_path(encyclopedia_output, tower.id .. ".png"),
				image_cache
			)
			exported = exported + 1

			if exported % 20 == 0 then
				print(string.format("DOVE_WIKI_ENCYCLOPEDIA=%d", exported))
			end
		end
	end

	for _, image in pairs(image_cache) do
		image:release()
	end

	print(string.format("DOVE_WIKI_ENCYCLOPEDIA=%d", exported))
end

local function export_skill_icons(towers)
	local image_cache = {}
	local exported = 0

	for _, tower in ipairs(towers) do
		for power_id, icon in pairs(tower.power_icons or {}) do
			export_atlas_crop(
				icon.atlas,
				join_path(skill_icon_output, tower.id .. "--" .. power_id .. ".png"),
				image_cache
			)
			exported = exported + 1
		end
	end

	for _, image in pairs(image_cache) do
		image:release()
	end

	print(string.format("DOVE_WIKI_SKILL_ICONS=%d", exported))
end

function love.load()
	if not game_root or game_root == "" then
		return fail("DOVE_GAME_DIR is required")
	end

	install_game_loader(game_root)

	KR_GAME = "kr1"
	KR_TARGET = "desktop"
	KR_PLATFORM = "win32"
	IS_ANDROID = false
	DEBUG = false
	ASSETS_CHECK_ENABLED = false
	KR_PATH_ROOT = ""
	KR_PATH_ALL = "all"
	KR_PATH_ALL_TARGET = "all-desktop"
	KR_PATH_GAME = "kr1"
	EDITOR_PATH = "game_editor"
	KR_PATH_GAME_TARGET = "kr1-desktop"
	KR_PATH_ASSETS_ROOT = "_assets"
	KR_PATH_ASSETS_ALL_TARGET = "_assets/all-desktop"
	KR_PATH_ASSETS_GAME_TARGET = "_assets/kr1-desktop"

	local ok, result = xpcall(function()
		require("all.constants")
		require("lib.klua.table")

		local entity_db = require("entity_db")
		entity_db:load()

		local count = 0
		for _ in pairs(entity_db.entities) do
			count = count + 1
		end

		print("DOVE_WIKI_ENTITY_COUNT=" .. count)

		local raw_export
		if (raw_output and raw_output ~= "") or (portrait_output and portrait_output ~= "") or
			(encyclopedia_output and encyclopedia_output ~= "") or
			(skill_icon_output and skill_icon_output ~= "") then
			raw_export = build_raw_export(entity_db)
		end

		if raw_output and raw_output ~= "" then
			local output = assert(io.open(raw_output, "wb"))
			output:write(json_encode(raw_export))
			output:close()
			print("DOVE_WIKI_RAW_OUTPUT=" .. raw_output)
		end

		if portrait_output and portrait_output ~= "" then
			export_portraits(raw_export.towers)
		end

		if encyclopedia_output and encyclopedia_output ~= "" then
			export_encyclopedia_images(raw_export.towers)
		end

		if skill_icon_output and skill_icon_output ~= "" then
			export_skill_icons(raw_export.towers)
		end

		local debug_tower = os.getenv("DOVE_DEBUG_TOWER")
		if debug_tower and entity_db.entities[debug_tower] then
			require("lib.klua.dump")
			fulldump(entity_db.entities[debug_tower], 5)
		end
	end, debug.traceback)

	if not ok then
		io.stderr:write(result .. "\n")
		return love.event.quit(1)
	end

	love.event.quit(0)
end
