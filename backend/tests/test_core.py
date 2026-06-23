from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from types import SimpleNamespace

from backend.app.ai_service import get_ai_config, save_ai_config, suggest_with_ai
from backend.app.exporter import export_content_pack
from backend.app import item_catalog
from backend.app.models import AISuggestRequest, GameDataEntry, PatchEntry, SaveAIConfigRequest
from backend.app.project_io import new_project, open_project, write_project_package
from backend.app.project_io import import_asset
from backend.app.rule_library_loader import ai_rule_context, load_rule_library
from backend.app.rules import load_ruleset
from backend.app.validator import validate_project


class CoreTests(unittest.TestCase):
    def test_save_open_roundtrip(self):
        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.UniqueID = "Author.TestPack"
            project.patches.append(PatchEntry(name="Object edit", target="Data/Objects", fields={"Entries": {"Test": "Value"}}))
            path = Path(temp_dir) / "test.cpgen"

            write_project_package(project, str(path))
            reopened = open_project(str(path))

            self.assertEqual(reopened.manifest.Name, "Test Pack")
            self.assertEqual(reopened.patches[0].fields["Entries"]["Test"], "Value")

    def test_validate_manifest_error(self):
        project = new_project()
        result = validate_project(project)
        self.assertFalse(result.can_export)
        self.assertTrue(any(issue.path == "manifest.UniqueID" for issue in result.errors))

    def test_export_content_pack(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.patches.extend(
                [
                    PatchEntry(action="Load", target="Data/Foo", from_file="assets/foo.json"),
                    PatchEntry(action="EditData", target="Data/Objects", fields={"Entries": {"Example": {"Name": "Example"}}}),
                    PatchEntry(action="EditImage", target="LooseSprites/Cursors", from_file="assets/cursors.png"),
                    PatchEntry(action="EditMap", target="Maps/Farm", from_file="assets/farm.tmx"),
                    PatchEntry(action="Include", from_file="assets/more-patches.json"),
                ]
            )
            project.game_data.append(GameDataEntry(kind="item", target="Data/Objects", key="ExampleItem", value={"Name": "Example"}))

            output = export_content_pack(project, temp_dir)

            self.assertTrue((output / "manifest.json").exists())
            self.assertTrue((output / "content.json").exists())
            self.assertTrue((output / "i18n" / "default.json").exists())
            self.assertEqual((output / "assets" / "blank.json").read_text(encoding="utf-8").strip(), "{}")
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            self.assertNotIn("StardewCPStudio", json.dumps(content))

    def test_export_filters_internal_studio_metadata(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.patches.append(PatchEntry(
                action="EditData",
                target="Data/Objects",
                fields={"Entries": {"Example": {"Name": "Example"}}},
                advanced={"StardewCPStudio": {"hidden": True}, "PublicField": "kept"},
            ))
            project.game_data.append(GameDataEntry(
                kind="npc",
                target="Data/Characters",
                key="ExampleNPC",
                value={"DisplayName": "Example"},
                advanced={"StardewCPStudio": {"npc": {"relationshipRoute": "roommate"}}, "PublicField": "kept"},
            ))

            output = export_content_pack(project, temp_dir)
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            text = json.dumps(content)

            self.assertNotIn("StardewCPStudio", text)
            self.assertEqual(sum(1 for change in content["Changes"] if change.get("PublicField") == "kept"), 2)

    def test_export_dialogue_uses_sve_style_include_files(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.i18n = {
                "Sophia.CharacterDialogue.Mon": "Hello on Monday.",
                "Sophia.CharacterDialogue.Mon4": "Four-heart Monday.",
                "Sophia.CharacterDialogue.Rain": "Rain only.",
                "Sophia.MarriageDialogue.Rainy_Day_0": "Rainy spouse line.",
                "Sophia.MarriageDialogue.Good_9": "Good spouse line.",
                "Sophia.MarriageDialogue.Rainy_Night_5": "Rainy night spouse line.",
            }
            project.game_data.extend([
                GameDataEntry(kind="dialogue", target="Characters/Dialogue/Sophia", key="Mon", value="{{i18n:Sophia.CharacterDialogue.Mon}}"),
                GameDataEntry(kind="dialogue", target="Characters/Dialogue/Sophia", key="Mon4", value="{{i18n:Sophia.CharacterDialogue.Mon4}}"),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/Sophia",
                    key="rainy",
                    value="{{i18n:Sophia.CharacterDialogue.Rain}}",
                    when={"Season": "spring"},
                ),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/MarriageDialogueSophia",
                    key="Rainy_Day_0",
                    value="{{i18n:Sophia.MarriageDialogue.Rainy_Day_0}}",
                ),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/MarriageDialogueSophia",
                    key="Good_9",
                    value="{{i18n:Sophia.MarriageDialogue.Good_9}}",
                ),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/MarriageDialogueSophia",
                    key="Rainy_Night_5",
                    value="{{i18n:Sophia.MarriageDialogue.Rainy_Night_5}}",
                ),
            ])

            output = export_content_pack(project, temp_dir)
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            normal_file = output / "assets" / "CharacterFiles" / "Dialogue" / "Sophia" / "dialogue.json"
            marriage_file = output / "assets" / "CharacterFiles" / "Dialogue" / "Sophia" / "MarriageDialogue.json"
            normal = json.loads(normal_file.read_text(encoding="utf-8"))
            marriage = json.loads(marriage_file.read_text(encoding="utf-8"))

            self.assertTrue(any(change["Action"] == "Include" and change["FromFile"] == "assets/CharacterFiles/Dialogue/Sophia/dialogue.json" for change in content["Changes"]))
            self.assertTrue(any(change["Action"] == "Include" and change["FromFile"] == "assets/CharacterFiles/Dialogue/Sophia/MarriageDialogue.json" for change in content["Changes"]))
            self.assertTrue(any(change["Action"] == "Load" and change["Target"] == "Characters/Dialogue/Sophia" and change["FromFile"] == "assets/blank.json" for change in content["Changes"]))
            self.assertFalse(any(change["Action"] == "EditData" and change.get("Target") == "Characters/Dialogue/Sophia" for change in content["Changes"]))
            self.assertEqual(len(normal["Changes"]), 2)
            no_when = next(change for change in normal["Changes"] if "When" not in change)
            with_when = next(change for change in normal["Changes"] if "When" in change)
            self.assertEqual(no_when["Entries"]["Mon"], "{{i18n:Sophia.CharacterDialogue.Mon}}")
            self.assertEqual(no_when["Entries"]["Mon4"], "{{i18n:Sophia.CharacterDialogue.Mon4}}")
            self.assertEqual(with_when["Entries"]["rainy"], "{{i18n:Sophia.CharacterDialogue.Rain}}")
            self.assertEqual(marriage["Changes"][0]["Entries"]["Rainy_Day_0"], "{{i18n:Sophia.MarriageDialogue.Rainy_Day_0}}")
            self.assertEqual(marriage["Changes"][0]["Entries"]["Good_9"], "{{i18n:Sophia.MarriageDialogue.Good_9}}")
            self.assertEqual(marriage["Changes"][0]["Entries"]["Rainy_Night_5"], "{{i18n:Sophia.MarriageDialogue.Rainy_Night_5}}")
            self.assertFalse(any(key.endswith("_n") for key in marriage["Changes"][0]["Entries"]))

    def test_import_asset_can_use_character_asset_path(self):
        import asyncio

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            with Path(__file__).open("rb") as upload_file:
                upload = SimpleNamespace(
                    filename="Sophia.png",
                    content_type="image/png",
                    file=upload_file,
                )
                project, asset, temp_path = asyncio.run(import_asset(
                    project,
                    upload,
                    Path(temp_dir),
                    "assets/CharacterFiles/Portraits/Sophia/Sophia.png",
                ))

            self.assertTrue(temp_path.exists())
            self.assertEqual(asset.stored_path, "assets/CharacterFiles/Portraits/Sophia/Sophia.png")
            self.assertEqual(project.assets[0].stored_path, asset.stored_path)

    def test_ai_config_does_not_expose_key(self):
        with TemporaryDirectory() as temp_dir:
            runtime = Path(temp_dir)
            saved = save_ai_config(runtime, SaveAIConfigRequest(provider="deepseek", model="deepseek-chat", api_key="secret-key"))
            loaded = get_ai_config(runtime)

            self.assertTrue(saved.api_key_set)
            self.assertTrue(loaded.api_key_set)
            self.assertEqual(loaded.api_key_suffix, "-key")
            self.assertFalse(hasattr(loaded, "api_key"))

    def test_ai_suggest_requires_key(self):
        with TemporaryDirectory() as temp_dir:
            with self.assertRaises(ValueError) as context:
                suggest_with_ai(Path(temp_dir), AISuggestRequest(kind="when", prompt="春天第一天生效"))

            self.assertIn("API Key", str(context.exception))

    def test_ruleset_field_schemas_are_loaded(self):
        ruleset = load_ruleset()

        self.assertIn("seasons", ruleset.field_schemas)
        self.assertIn("when_conditions", ruleset.field_schemas)

    def test_rule_library_and_ai_context_are_loaded(self):
        library = load_rule_library()
        context = ai_rule_context()

        self.assertIn("content_patcher", library)
        self.assertIn("game_data", library)
        self.assertTrue(context["content_patcher"]["patch_actions"])
        self.assertTrue(context["game_data"]["targets"])
        self.assertIn("text_operations", context["content_patcher"])
        self.assertIn("common_field_types", context["game_data"])
        self.assertTrue(context["reference_patterns"])
        self.assertTrue(any(reference["id"] == "sve-cp-structure" for reference in context["reference_patterns"]))
        self.assertTrue(any(target["target"] == "Data/NPCGiftTastes" for target in context["game_data"]["targets"]))
        self.assertTrue(any(target["target"] == "Data/TriggerActions" for target in context["game_data"]["targets"]))
        dialogue = next(target for target in context["game_data"]["targets"] if target["kind"] == "dialogue")
        event = next(target for target in context["game_data"]["targets"] if target["kind"] == "event")
        schedule = next(target for target in context["game_data"]["targets"] if target["kind"] == "schedule")
        gift_taste = next(target for target in context["game_data"]["targets"] if target["kind"] == "gift_taste")
        mail = next(target for target in context["game_data"]["targets"] if target["kind"] == "mail")
        trigger_action = next(target for target in context["game_data"]["targets"] if target["kind"] == "trigger_action")
        npc = next(target for target in context["game_data"]["targets"] if target["kind"] == "npc")
        item = next(target for target in context["game_data"]["targets"] if target["kind"] == "item")
        location = next(target for target in context["game_data"]["targets"] if target["kind"] == "location")

        self.assertTrue(dialogue["commands"])
        self.assertTrue(dialogue["dialogue_key_builder"])
        self.assertTrue(event["event_commands"])
        self.assertTrue(schedule["schedule_points"])
        self.assertTrue(gift_taste["taste_groups"])
        self.assertTrue(gift_taste["text_operation_templates"])
        self.assertTrue(mail["mail_markers"])
        self.assertTrue(mail["attachment_types"])
        self.assertTrue(trigger_action["action_examples"])
        self.assertTrue(trigger_action["trigger_examples"])
        self.assertTrue(npc["field_groups"])
        self.assertTrue(npc["related_assets"])
        self.assertTrue(item["item_data_targets"])
        self.assertTrue(location["substructures"])

    def test_item_catalog_loads_objects_json(self):
        import json

        with TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "Objects.json"
            path.write_text(json.dumps({
                "388": {
                    "Name": "Wood",
                    "DisplayName": "[LocalizedText Strings\\Objects:Wood_Name]",
                    "Type": "Basic",
                    "Category": -16,
                }
            }), encoding="utf-8")
            previous_paths = item_catalog.KNOWN_OBJECT_PATHS
            item_catalog.load_item_catalog.cache_clear()
            try:
                item_catalog.KNOWN_OBJECT_PATHS = [path]
                catalog = item_catalog.load_item_catalog()
            finally:
                item_catalog.KNOWN_OBJECT_PATHS = previous_paths
                item_catalog.load_item_catalog.cache_clear()

            self.assertEqual(catalog.items[0].id, "388")
            self.assertEqual(catalog.items[0].qualified_id, "(O)388")
            self.assertEqual(catalog.items[0].category, -16)


if __name__ == "__main__":
    unittest.main()
